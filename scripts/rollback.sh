#!/usr/bin/env bash
# ==========================================
# AssetTrack rollback (VM with PM2 + nginx)
# ==========================================
# Puts an earlier commit back live: checkout -> npm ci -> build the web app ->
# pm2 reload with GIT_COMMIT -> wait for /api/health to report that commit.
#
#   scripts/rollback.sh <commit>          e.g. the "previous" commit printed by deploy.sh
#   scripts/rollback.sh --list            show recent deploys (logs/deploys.log)
#
# Options: --timeout <sec> (default 90)
#
# DATABASE MIGRATIONS ARE NOT ROLLED BACK. The older code runs against the
# current schema. If a migration must be undone, do it deliberately with the
# matching script in supabase/rollbacks/ after taking a backup
# (docs/RUNBOOK.md, "Roll back a release").
set -euo pipefail

# shellcheck source=lib/deploy_common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy_common.sh"

TARGET=""
TIMEOUT=90
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout) TIMEOUT="${2:?--timeout needs a number of seconds}"; shift ;;
    --list)
      if [ -f "$DEPLOY_LOG" ]; then tail -n 20 "$DEPLOY_LOG"; else echo "No deploys recorded yet ($DEPLOY_LOG)."; fi
      exit 0 ;;
    -h|--help) sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "Unknown option: $1 (see --help)" ;;
    *) TARGET="$1" ;;
  esac
  shift
done
[ -n "$TARGET" ] || die "Usage: scripts/rollback.sh <commit>   (scripts/rollback.sh --list shows recent deploys)"
case "$TIMEOUT" in ''|*[!0-9]*) die "--timeout must be a number of seconds" ;; esac

require_commands git node npm pm2 curl
cd "$REPO_DIR"
acquire_lock
trap 'rm -rf "$REPO_DIR/client/dist-next"; release_lock' EXIT

step "Preflight"
check_node_version
require_clean_tree
CURRENT="$(git rev-parse HEAD)"
if ! TARGET_COMMIT="$(git rev-parse --verify --quiet "$TARGET^{commit}")"; then
  info "Commit not found locally; fetching from origin"
  git fetch --quiet --prune --tags origin
  TARGET_COMMIT="$(resolve_commit "$TARGET")"
fi
info "Currently checked out: $(short "$CURRENT")"
info "Rolling back to:       $(short "$TARGET_COMMIT") $(git log -1 --format='(%ar): %s' "$TARGET_COMMIT" | cut -c1-80)"

# Migrations that exist in the current tree but not in the target are already
# applied to the database and stay applied.
NEWER_MIGRATIONS="$(git diff --name-only --diff-filter=A "$TARGET_COMMIT" "$CURRENT" -- supabase/migrations/ || true)"
if [ -n "$NEWER_MIGRATIONS" ]; then
  warn "These migrations are newer than the target and will STAY applied:"
  printf '%s\n' "$NEWER_MIGRATIONS" | sed 's/^/      /' >&2
  warn "The target code must work with them. Manual undo scripts: supabase/rollbacks/"
fi

step "Building $(short "$TARGET_COMMIT")"
checkout_commit "$TARGET_COMMIT"
install_server_deps
install_client_deps
build_client

step "Releasing $(short "$TARGET_COMMIT")"
activate_client_build
reload_api "$TARGET_COMMIT"
if wait_for_commit "$TARGET_COMMIT" "$TIMEOUT"; then
  record_deploy "rollback" "$TARGET_COMMIT" "$CURRENT"
  step "Rolled back to $(short "$TARGET_COMMIT") (was $(short "$CURRENT"))"
  exit 0
fi
record_deploy "rollback-unhealthy" "$TARGET_COMMIT" "$CURRENT"
info "Recent API log lines:"
pm2 logs "$PM2_APP_NAME" --lines 30 --nostream 2>/dev/null | sed 's/^/      /' || true
die "$(short "$TARGET_COMMIT") is live but /api/health did not report it healthy. See docs/RUNBOOK.md."
