#!/usr/bin/env bash
# ==========================================
# AssetTrack Postgres (Supabase) Backup
# ==========================================
# Dumps the production database with pg_dump (PostgreSQL client tools 17+
# must be installed on the machine running this). Best run daily via cron:
#   0 2 * * * /path/to/assettrack/scripts/backup_db.sh >> /var/log/assettrack-backup.log 2>&1
#
# Settings (environment variables):
#   DATABASE_URL     connection string; if unset it is read from server/.env
#   BACKUP_DIR       where dumps are written (default /var/backups/assettrack)
#   RETENTION_DAYS   dumps older than this are deleted (default 30)
#
# Restore a dump into an EMPTY database with:
#   pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" assettrack_<timestamp>.dump
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/assettrack}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$SCRIPT_DIR/../server/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$SCRIPT_DIR/../server/.env" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set and was not found in server/.env" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required to read DATABASE_URL." >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump is not installed (install the PostgreSQL client tools)." >&2
  exit 1
fi

# Dumps and the temporary connection file are readable by this user only.
umask 077

# Pass the connection details (including the password) through a private
# service file rather than the command line, where `ps` would show them.
SERVICE_FILE="$(mktemp)"
BACKUP_FILE=""
cleanup() {
  rm -f "$SERVICE_FILE"
  if [ -n "$BACKUP_FILE" ]; then rm -f "$BACKUP_FILE.partial"; fi
}
trap cleanup EXIT
DATABASE_URL="$DATABASE_URL" node -e '
  const url = new URL(process.env.DATABASE_URL);
  const lines = ["[assettrack]",
    `host=${url.hostname}`, `port=${url.port || 5432}`,
    `dbname=${decodeURIComponent(url.pathname.slice(1)) || "postgres"}`,
    `user=${decodeURIComponent(url.username)}`, `password=${decodeURIComponent(url.password)}`,
    `sslmode=${url.searchParams.get("sslmode") || (["localhost", "127.0.0.1"].includes(url.hostname) ? "prefer" : "require")}`];
  process.stdout.write(lines.join("\n") + "\n");
' > "$SERVICE_FILE"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +"%Y-%m-%d_%H-%M-%S")"
BACKUP_FILE="$BACKUP_DIR/assettrack_$TIMESTAMP.dump"

echo "[$(date)] Starting backup to $BACKUP_FILE"
# Custom format is compressed and restorable table-by-table with pg_restore.
# Only the application schema is dumped, not Supabase's internal schemas.
PGSERVICEFILE="$SERVICE_FILE" PGSERVICE=assettrack pg_dump --format=custom --schema=public --no-owner --no-privileges --file="$BACKUP_FILE.partial"
mv "$BACKUP_FILE.partial" "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: backup file is empty: $BACKUP_FILE" >&2
  exit 1
fi
echo "[$(date)] Backup complete: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "[$(date)] Deleting backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'assettrack_*.dump' -type f -mtime +"$RETENTION_DAYS" -delete
