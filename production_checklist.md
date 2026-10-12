# AssetTrack Production Checklist

Work through this before each production deploy. See README.md for what each
setting does and [docs/RUNBOOK.md](docs/RUNBOOK.md) for how to do each step.

## 1. Configuration

- [ ] API environment (hosting platform variables, or `server/.env` on a VM):
  `NODE_ENV=production`, `DATABASE_URL` (Supabase **session pooler**, port 5432),
  `CLIENT_ORIGIN` (the web app's exact origin), `GOOGLE_CLIENT_ID`,
  `GOOGLE_ALLOWED_DOMAIN=thinkvibes.com`, `LOGIN_EMAIL_DOMAINS=thinkvibes.com`.
- [ ] `TRUST_PROXY_HOPS=1` when the API sits behind nginx (one proxy hop).
  Without it every request appears to come from 127.0.0.1, so the per-address
  rate limits (10 failed sign-ins per 15 minutes; 1200 requests per minute)
  treat the whole office as one IP. (The account lockout is per account and
  isn't affected.)
- [ ] `DATABASE_SSL_CA_FILE` pointing at Supabase's CA certificate
  (Dashboard → Database → SSL) to verify the database certificate; then
  `DATABASE_SSL_REQUIRE_CA=true` so a missing file stops startup instead of
  only warning.
- [ ] Optional: `SENTRY_DSN` (API) and `VITE_SENTRY_DSN` (web app) for error
  reports; `LOG_LEVEL` if `info` is not wanted.
- [ ] Every production `.env` value is also in the team password manager
  (never only on the VM).
- [ ] Web app built with the production values: `VITE_API_BASE_URL` (if the API
  is not served under the same origin at `/api`) and `VITE_GOOGLE_CLIENT_ID`.
- [ ] The production origin is listed under **Authorized JavaScript origins**
  for the Google OAuth client.
- [ ] After deploy, `GET /api/google/config` returns `"enabled": true` and
  `GET /api/health` returns `"database": "connected"` and the deployed `commit`.
- [ ] No `.env` file, database dump or spreadsheet export is committed
  (`.gitignore` covers them — check `git status` before pushing).

## 2. Database

- [ ] Back up first: `scripts/backup_db.sh` (needs PostgreSQL client tools 17+),
  or a Supabase dashboard backup.
- [ ] **Apply migrations BEFORE deploying code that needs them**, and only
  migrations the currently running code also works with (add columns/tables
  first; drop or rename in a later release). `scripts/deploy.sh` enforces the
  order: it stops when migrations are pending, and with `--migrate` it backs up,
  applies them, and only then restarts the API.
- [ ] To apply by hand instead: see what production is missing, then apply it (each file runs in its own
  transaction and is recorded in `app_migrations`):
  `node scripts/migrate.js status --env-file .env.supabase.local` then
  `node scripts/migrate.js apply --env-file .env.supabase.local --yes` (from `server/`).
  The first time, record what production already has with
  `baseline --through <last applied file>`. Never re-run old migrations by hand,
  and never apply files from `supabase/rollbacks/` unless deliberately undoing a change.
- [ ] Daily backup cron installed on the VM
  (`0 2 * * * /var/www/assettrack/scripts/backup_db.sh >> …/logs/backup.log 2>&1`).
- [ ] Encrypted off-site copy of the dumps (rclone crypt / gpg + S3 or Google
  Drive) with 30–90 day expiry; passphrase in the password manager.
- [ ] Monthly restore test scheduled with an owner (RUNBOOK → Backups), and the
  first one done before go-live.

### Supabase dashboard settings (manual, see RUNBOOK)

- [ ] Network restrictions: only the VM's IP (plus a named dev IP if
  migrations/backups run from there).
- [ ] Enforce SSL on incoming connections.
- [ ] Point-in-time recovery enabled.
- [ ] Spend cap / usage alerts going to the owner.
- [ ] Data API disabled, or confirmed locked down: migration
  `20261008100000_lock_down_public_schema.sql` (RLS on every table, `anon` and
  `authenticated` revoked) is applied.

## 3. Accounts

- [ ] No real account uses a shared or default password. The seeded test
  password (`password`) and test accounts (`admin@company.com` etc.) must not
  exist in production. Accounts whose password may be known are flagged
  `must_change_password = true` so they must set a new one at next login.
- [ ] Only the people who need it have the Director role.
- [ ] The GitHub repository is private.

## 4. Security & HTTPS

- [ ] Served over HTTPS only (camera scanning and Google sign-in need it).
  `nginx.conf.example` shows a reverse-proxy setup with HSTS.
- [ ] Only ports 80/443 are exposed; the API listens on localhost or a private
  network.
- [ ] nginx uses `nginx.conf.example` with the security-header snippet
  (`nginx-security-headers.conf.example` → `/etc/nginx/snippets/`):
  `/assets/*` served with `Cache-Control: public, immutable` (1 year),
  `index.html` with `no-cache`, gzip on, and the security headers present on
  both (`curl -sI https://…/` and `curl -sI https://…/assets/<file>.js`).

## 5. Running

- [ ] The API runs under PM2 (`ecosystem.config.js`), started on boot
  (`pm2 startup` + `pm2 save`). Deploys use `scripts/deploy.sh`, which runs
  `pm2 reload ecosystem.config.js --update-env` with `GIT_COMMIT` set. PM2
  stops the API with SIGINT; the server finishes in-flight requests and closes
  the database pool (`kill_timeout` 10 s).
- [ ] PM2 log rotation installed once per VM:
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 10M
  pm2 set pm2-logrotate:retain 30
  pm2 set pm2-logrotate:compress true
  pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
  ```
- [ ] Uptime monitor (UptimeRobot / Better Stack) on `/api/health`, alerting a
  named person, plus certificate-expiry alerts.
- [ ] The web app (`client/dist`) is served as static files with a fallback to
  `index.html` for client-side routes.
- [ ] Startup logs show `Server listening on port …` and the Google sign-in
  status line.

## 6. After deploy

- [ ] Log in with a real account (a flagged account is asked for a new password
  first); open Dashboard, Inventory, Tickets, Onboarding, Offboarding and Scanner.
- [ ] Deploys that change session storage sign everyone out once — tell users.
- [ ] Note the previous commit printed by `scripts/deploy.sh`; roll back with
  `scripts/rollback.sh <commit>` if needed.
