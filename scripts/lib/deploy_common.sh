# Shared helpers for scripts/deploy.sh and scripts/rollback.sh.
# Sourced, not executed. Expects `set -euo pipefail` in the caller.
#
# Layout assumed (see README.md / production_checklist.md):
#   - this repository is checked out on the VM (e.g. /var/www/assettrack)
#   - server/.env holds the production settings (never printed here)
#   - nginx serves client/dist and proxies /api to 127.0.0.1:$PORT
#   - PM2 runs the API from ecosystem.config.js (app name assettrack-api)

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PM2_APP_NAME="assettrack-api"
DEPLOY_LOG="$REPO_DIR/logs/deploys.log"
LOCK_DIR="${TMPDIR:-/tmp}/assettrack-deploy.lock"

if [ -t 1 ]; then
  C_BOLD=$'\033[1m'; C_RED=$'\033[31m'; C_YEL=$'\033[33m'; C_GRN=$'\033[32m'; C_OFF=$'\033[0m'
else
  C_BOLD=''; C_RED=''; C_YEL=''; C_GRN=''; C_OFF=''
fi

step() { printf '\n%s==> %s%s\n' "$C_BOLD" "$*" "$C_OFF"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '%s    OK: %s%s\n' "$C_GRN" "$*" "$C_OFF"; }
warn() { printf '%s    WARNING: %s%s\n' "$C_YEL" "$*" "$C_OFF" >&2; }
die()  { printf '%sERROR: %s%s\n' "$C_RED" "$*" "$C_OFF" >&2; exit 1; }

require_commands() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is not installed or not on PATH."
  done
}

# Only one deploy/rollback at a time.
acquire_lock() {
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    die "Another deploy or rollback seems to be running (lock: $LOCK_DIR). If not, remove that directory and retry."
  fi
}
release_lock() { rmdir "$LOCK_DIR" 2>/dev/null || true; }

check_node_version() {
  local wanted current
  wanted="$(tr -d ' \n\r' < "$REPO_DIR/.nvmrc" 2>/dev/null || true)"
  current="$(node -p 'process.versions.node.split(".")[0]')"
  if [ -n "$wanted" ] && [ "${wanted%%.*}" != "$current" ]; then
    warn "Node $current is active but .nvmrc asks for $wanted."
  fi
}

# Local edits to tracked files would be lost or block the checkout.
require_clean_tree() {
  if ! git -C "$REPO_DIR" diff --quiet || ! git -C "$REPO_DIR" diff --cached --quiet; then
    git -C "$REPO_DIR" status --short --untracked-files=no >&2
    die "Tracked files have local changes on this machine. Commit/stash them (or discard) first."
  fi
}

resolve_commit() {
  git -C "$REPO_DIR" rev-parse --verify --quiet "$1^{commit}" || die "Unknown git ref or commit: $1"
}

short() { printf '%s' "${1:0:9}"; }

checkout_commit() {
  info "Checking out $(short "$1") ($(git -C "$REPO_DIR" log -1 --format='%s' "$1" | cut -c1-72))"
  git -C "$REPO_DIR" checkout --quiet --detach "$1"
}

install_server_deps() {
  info "npm ci (server, production dependencies only)"
  npm ci --omit=dev --no-audit --no-fund --prefix "$REPO_DIR/server" >/dev/null
}

install_client_deps() {
  info "npm ci (client)"
  npm ci --no-audit --no-fund --prefix "$REPO_DIR/client" >/dev/null
}

# Builds into client/dist-next, then swaps it in for client/dist so nginx never
# serves a half-written build. Hashed files from the previous build that are
# less than 14 days old are carried over, so browser tabs still running the
# previous version can lazy-load their chunks instead of hitting a 404.
build_client() {
  local client="$REPO_DIR/client"
  rm -rf "$client/dist-next"
  info "Building web app (reads client/.env / .env.production for VITE_* values)"
  # VITE_GIT_COMMIT tags web-app error reports (Sentry release) with the commit.
  VITE_GIT_COMMIT="$(git -C "$REPO_DIR" rev-parse HEAD)" \
    npm run build --prefix "$client" -- --outDir dist-next --emptyOutDir >/dev/null
  [ -s "$client/dist-next/index.html" ] || die "Client build produced no index.html."
}

activate_client_build() {
  local client="$REPO_DIR/client"
  [ -d "$client/dist-next" ] || die "No client build to activate."
  if [ -d "$client/dist/assets" ]; then
    mkdir -p "$client/dist-next/assets"
    find "$client/dist/assets" -maxdepth 1 -type f -mtime -14 -exec cp -np {} "$client/dist-next/assets/" \;
  fi
  rm -rf "$client/dist.prev"
  if [ -d "$client/dist" ]; then mv "$client/dist" "$client/dist.prev"; fi
  mv "$client/dist-next" "$client/dist"
  rm -rf "$client/dist.prev"
  ok "Web app files switched to the new build"
}

# Restarts the API with GIT_COMMIT set, so /api/health reports this commit.
reload_api() {
  export GIT_COMMIT="$1"
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    info "pm2 reload ($PM2_APP_NAME, GIT_COMMIT=$(short "$1"))"
    pm2 reload "$REPO_DIR/ecosystem.config.js" --update-env >/dev/null
  else
    info "pm2 start ($PM2_APP_NAME was not running, GIT_COMMIT=$(short "$1"))"
    pm2 start "$REPO_DIR/ecosystem.config.js" >/dev/null
  fi
  pm2 save >/dev/null 2>&1 || warn "pm2 save failed; the process list may not survive a reboot."
}

health_url() {
  if [ -n "${HEALTH_URL:-}" ]; then printf '%s' "$HEALTH_URL"; return; fi
  local port=""
  if [ -f "$REPO_DIR/server/.env" ]; then
    port="$(grep -E '^PORT=' "$REPO_DIR/server/.env" | tail -n 1 | cut -d= -f2- | tr -d '"'"'"' \r')"
  fi
  printf 'http://127.0.0.1:%s/api/health' "${port:-3001}"
}

# Prints "<status> <commit>" from /api/health, or nothing if unreachable.
read_health() {
  curl -sS --max-time 5 "$1" 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
      try { const j = JSON.parse(s); process.stdout.write(`${j.status || "?"} ${j.commit || "?"}`); } catch { /* not JSON yet */ }
    });' || true
}

# Polls /api/health until it reports status "ok" and the expected commit
# (full or abbreviated SHA). Returns non-zero on timeout.
wait_for_commit() {
  local expected="$1" timeout="$2" url deadline status commit reply
  url="$(health_url)"
  deadline=$(( $(date +%s) + timeout ))
  info "Waiting up to ${timeout}s for $url to report $(short "$expected")"
  while [ "$(date +%s)" -lt "$deadline" ]; do
    reply="$(read_health "$url")"
    status="${reply%% *}"; commit="${reply#* }"
    if [ "$status" = "ok" ] && [ "${#commit}" -ge 7 ] && [ "${expected#"$commit"}" != "$expected" ]; then
      ok "API is healthy and running $(short "$expected")"
      return 0
    fi
    # Versions from before /api/health reported a commit (e.g. when rolling
    # back to one): healthy is the best that can be confirmed.
    if [ "$status" = "ok" ] && { [ "$commit" = "?" ] || [ "$commit" = "unknown" ]; }; then
      warn "API is healthy but does not report its commit (older version); assuming $(short "$expected")"
      return 0
    fi
    sleep 3
  done
  warn "Last health reply: ${reply:-<no response>}"
  return 1
}

record_deploy() {
  mkdir -p "$(dirname "$DEPLOY_LOG")"
  printf '%s %s %s (previous %s) by %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "${USER:-unknown}" >> "$DEPLOY_LOG"
}
