# AssetTrack Production Checklist

Work through this before each production deploy. See README.md for what each
setting does.

## 1. Configuration

- [ ] API environment (hosting platform variables, or `server/.env` on a VM):
  `NODE_ENV=production`, `DATABASE_URL` (Supabase **session pooler**, port 5432),
  `CLIENT_ORIGIN` (the web app's exact origin), `GOOGLE_CLIENT_ID`,
  `GOOGLE_ALLOWED_DOMAIN=thinkvibes.com`, `LOGIN_EMAIL_DOMAINS=thinkvibes.com`.
- [ ] `TRUST_PROXY_HOPS=1` if the API sits behind one reverse proxy (so login
  rate limits see real client IPs).
- [ ] Optional: `DATABASE_SSL_CA_FILE` pointing at Supabase's CA certificate
  (Dashboard → Database → SSL) to verify the database certificate.
- [ ] Web app built with the production values: `VITE_API_BASE_URL` (if the API
  is not served under the same origin at `/api`) and `VITE_GOOGLE_CLIENT_ID`.
- [ ] The production origin is listed under **Authorized JavaScript origins**
  for the Google OAuth client.
- [ ] After deploy, `GET /api/google/config` returns `"enabled": true` and
  `GET /api/health` returns `"database": "connected"`.
- [ ] No `.env` file, database dump or spreadsheet export is committed
  (`.gitignore` covers them — check `git status` before pushing).

## 2. Database

- [ ] Back up first: `scripts/backup_db.sh` (needs PostgreSQL client tools 17+),
  or a Supabase dashboard backup.
- [ ] See what production is missing, then apply it (each file runs in its own
  transaction and is recorded in `app_migrations`):
  `node scripts/migrate.js status --env-file .env.supabase.local` then
  `node scripts/migrate.js apply --env-file .env.supabase.local --yes` (from `server/`).
  The first time, record what production already has with
  `baseline --through <last applied file>`. Never re-run old migrations by hand,
  and never apply files from `supabase/rollbacks/` unless deliberately undoing a change.
- [ ] Schedule the backup daily (cron example in the script header) and test a
  restore into a scratch database at least once.

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

## 5. Running

- [ ] The API runs under a process manager or platform that restarts it on
  crash (`pm2 start ecosystem.config.js --env production` on a VM).
- [ ] The web app (`client/dist`) is served as static files with a fallback to
  `index.html` for client-side routes.
- [ ] Startup logs show `Server listening on port …` and the Google sign-in
  status line.

## 6. After deploy

- [ ] Log in with a real account (a flagged account is asked for a new password
  first); open Dashboard, Inventory, Tickets, Onboarding, Offboarding and Scanner.
- [ ] Deploys that change session storage sign everyone out once — tell users.
