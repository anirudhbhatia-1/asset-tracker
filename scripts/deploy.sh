#!/usr/bin/env bash
# ==========================================
# AssetTrack deploy (VM with PM2 + nginx)
# ==========================================
# Run ON THE VM, from the deployed checkout (e.g. /var/www/assettrack), as the
# user that owns the checkout and runs PM2:
#
#   scripts/deploy.sh                      deploy origin/main
#   scripts/deploy.sh v1.4.0               deploy a tag, branch or commit
#   scripts/deploy.sh --migrate            also apply pending DB migrations
#
# Options:
#   --migrate        apply pending migrations (after a backup) before the API
#                    restarts. Without it, a deploy with pending migrations
#                    lists them and stops without changing anything.
#   --no-backup      with --migrate: skip scripts/backup_db.sh (not recommended)
#   --timeout <sec>  how long to wait for /api/health (default 90)
#
# Steps: git fetch -> check out the ref (detached) -> check migrations ->
# npm ci (server, client) -> build the web app -> [backup + apply migrations]
# -> switch the web app files -> pm2 reload with GIT_COMMIT -> poll
# /api/health until it reports the new commit.
#
# If the API does not come up healthy on the new commit in time, the previous
# commit is rebuilt and reloaded automatically and the script exits non-zero.
#
# KNOWN LIMITATION: the new code and server/node_modules are installed in
# place while the old process keeps serving (a few minutes). If PM2 restarts
# the API in that window (a crash, the memory limit, a reboot) it starts the
# new code early — before its migrations, possibly with half-installed
# packages. Deploy at a quiet time; a future version should build into a
# separate release directory and switch a symlink.
#
# DATABASE MIGRATIONS ARE NEVER ROLLED BACK AUTOMATICALLY. Migrations must be
# backwards compatible with the previous release (add columns/tables first,
# remove them in a later release). To undo one deliberately, use the manual
# scripts in supabase/rollbacks/ after taking a backup (see docs/RUNBOOK.md).
#
# Environment: HEALTH_URL overrides the health endpoint
# (default http://127.0.0.1:$PORT/api/health, PORT from server/.env).
# Nothing from server/.env is printed.
set -euo pipefail

# shellcheck source=lib/deploy_common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy_common.sh"

REF="origin/main"
MIGRATE=0
BACKUP=1
TIMEOUT=90

usage() { sed -n '2,36p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --migrate) MIGRATE=1 ;;
    --no-backup) BACKUP=0 ;;
    --timeout) TIMEOUT="${2:?--timeout needs a number of seconds}"; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) die "Unknown option: $1 (see --help)" ;;
    *) REF="$1" ;;
  esac
  shift
done
case "$TIMEOUT" in ''|*[!0-9]*) die "--timeout must be a number of seconds" ;; esac

require_commands git node npm pm2 curl
cd "$REPO_DIR"
acquire_lock

PHASE="prepare"
PREV_COMMIT=""
NEW_COMMIT=""
MIGRATIONS_APPLIED=0

# Undo a failed deploy. Before the API was reloaded only the checkout and the
# installed packages changed; after it, the previous build is restored too.
on_exit() {
  local code=$?
  rm -rf "$REPO_DIR/client/dist-next"
  if [ "$code" -ne 0 ] && [ -n "$PREV_COMMIT" ]; then
    case "$PHASE" in
      build)
        printf '\n' >&2
        warn "Deploy failed before the API was restarted; the live site is unchanged."
        warn "Restoring the checkout and server packages of $(short "$PREV_COMMIT")."
        git -C "$REPO_DIR" checkout --quiet --detach "$PREV_COMMIT" || true
        install_server_deps || warn "npm ci (server) failed - run scripts/rollback.sh $PREV_COMMIT"
        ;;
      release|rollback)
        printf '\n' >&2
        warn "Deploy stopped during the $PHASE step; the live state may be mixed."
        warn "Restore the previous release with: scripts/rollback.sh $PREV_COMMIT"
        ;;
    esac
    if [ "$MIGRATIONS_APPLIED" -eq 1 ]; then
      warn "Database migrations WERE applied and have NOT been rolled back."
      warn "The previous code must work with the new schema; see supabase/rollbacks/ and docs/RUNBOOK.md."
    fi
  fi
  release_lock
  exit "$code"
}
trap on_exit EXIT

step "Preflight"
check_node_version
require_clean_tree
PREV_COMMIT="$(git rev-parse HEAD)"
info "Currently deployed: $(short "$PREV_COMMIT")"
info "Health endpoint:    $(health_url)"

step "Fetching $REF"
git fetch --quiet --prune --tags origin
NEW_COMMIT="$(resolve_commit "$REF")"
info "Target: $(short "$NEW_COMMIT") $(git log -1 --format='(%an, %ar): %s' "$NEW_COMMIT" | cut -c1-90)"
if [ "$NEW_COMMIT" = "$PREV_COMMIT" ]; then
  warn "$(short "$NEW_COMMIT") is already checked out; rebuilding and reloading anyway."
elif ! git merge-base --is-ancestor "$PREV_COMMIT" "$NEW_COMMIT"; then
  warn "The target is not a descendant of the current commit (older release or another branch)."
fi

PHASE="build"
checkout_commit "$NEW_COMMIT"

step "Checking database migrations"
# Uses the packages already installed (migrate.js only needs pg and dotenv),
# so nothing changes if we stop here. A fresh checkout installs them first.
[ -d server/node_modules/pg ] || install_server_deps
# `status` is read-only and prints only the database host name.
STATUS_OUT="$(node server/scripts/migrate.js status 2>&1)" || {
  printf '%s\n' "$STATUS_OUT" >&2
  die "Could not read migration status (is DATABASE_URL in server/.env correct and reachable?)."
}
if grep -q 'No app_migrations table yet' <<<"$STATUS_OUT"; then
  printf '%s\n' "$STATUS_OUT"
  die "This database has no migration history. Record what it already has with 'baseline' first (README.md, Database changes)."
fi
if grep -q 'file changed since applied' <<<"$STATUS_OUT"; then
  grep 'file changed since applied' <<<"$STATUS_OUT" | sed 's/^/    /' >&2
  warn "Already-applied migration files were edited. They are not re-run; check this was intended."
fi
PENDING="$(grep '^PENDING' <<<"$STATUS_OUT" | awk '{print $2}' || true)"
if [ -n "$PENDING" ]; then
  info "Pending migrations:"
  printf '%s\n' "$PENDING" | sed 's/^/      /'
  if [ "$MIGRATE" -ne 1 ]; then
    printf '\n'
    warn "Not deploying: this release needs the migrations above."
    info "Review them, then re-run with --migrate (a backup is taken first):"
    info "  scripts/deploy.sh ${REF} --migrate"
    git checkout --quiet --detach "$PREV_COMMIT"
    PHASE="done"
    exit 2
  fi
else
  ok "No pending migrations"
fi

step "Installing dependencies"
install_server_deps
install_client_deps

step "Building web app"
build_client
ok "Build ready"

if [ -n "$PENDING" ]; then
  step "Applying database migrations"
  if [ "$BACKUP" -eq 1 ]; then
    info "Backing up the database first (scripts/backup_db.sh)"
    "$REPO_DIR/scripts/backup_db.sh" || die "Backup failed; migrations not applied. Use --no-backup only if you have another fresh backup."
  else
    warn "Skipping the pre-migration backup (--no-backup)."
  fi
  MIGRATIONS_APPLIED=1
  node server/scripts/migrate.js apply --yes
  ok "Migrations applied"
fi

PHASE="release"
step "Releasing $(short "$NEW_COMMIT")"
activate_client_build
reload_api "$NEW_COMMIT"

if wait_for_commit "$NEW_COMMIT" "$TIMEOUT"; then
  PHASE="done"
  record_deploy "deploy" "$NEW_COMMIT" "$PREV_COMMIT"
  step "Deployed $(short "$NEW_COMMIT") (previous: $(short "$PREV_COMMIT"))"
  info "Roll back with: scripts/rollback.sh $PREV_COMMIT"
  [ "$MIGRATIONS_APPLIED" -eq 1 ] && info "Note: rolling back code does not undo the migrations just applied."
  exit 0
fi

# ---- Automatic rollback ----
printf '\n' >&2
warn "The API did not report $(short "$NEW_COMMIT") as healthy within ${TIMEOUT}s."
info "Recent API log lines:"
pm2 logs "$PM2_APP_NAME" --lines 30 --nostream 2>/dev/null | sed 's/^/      /' || true

step "Rolling back to $(short "$PREV_COMMIT")"
PHASE="rollback"
checkout_commit "$PREV_COMMIT"
install_server_deps
install_client_deps
build_client
activate_client_build
reload_api "$PREV_COMMIT"
if wait_for_commit "$PREV_COMMIT" "$TIMEOUT"; then
  record_deploy "auto-rollback" "$PREV_COMMIT" "$NEW_COMMIT"
  warn "Rolled back to $(short "$PREV_COMMIT"). Deploy of $(short "$NEW_COMMIT") FAILED."
else
  record_deploy "auto-rollback-unhealthy" "$PREV_COMMIT" "$NEW_COMMIT"
  warn "Rolled back to $(short "$PREV_COMMIT") but it is not healthy either. Check 'pm2 logs $PM2_APP_NAME' and docs/RUNBOOK.md."
fi
PHASE="done"
exit 1
