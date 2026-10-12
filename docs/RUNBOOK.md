# AssetTrack Operations Runbook

What to do when something needs doing in production. The production setup is:
one Linux VM running nginx (TLS, static web app, `/api` proxy) and the Node API
under PM2, plus a Supabase Postgres database. Paths below assume the checkout
lives at `/var/www/assettrack`; adjust if yours differs.

Related: [README.md](../README.md) (setup, configuration, all env vars),
[production_checklist.md](../production_checklist.md) (pre-deploy checklist),
[PRIVACY_AND_RETENTION.md](PRIVACY_AND_RETENTION.md) (personal data handling).

| Situation | Go to |
|---|---|
| Ship a new version | [Deploy](#deploy) |
| New version is broken | [Roll back a release](#roll-back-a-release) |
| Which version is live? | [Check which build is live](#check-which-build-is-live) |
| Site down / VM gone | [The VM died](#the-vm-died) |
| Data lost or corrupted | [Restore from backup](#restore-from-backup) |
| Password / key leaked or staff change | [Rotate secrets](#rotate-secrets) |
| First-time hardening | [Supabase settings checklist](#supabase-settings-checklist-manual) |

---

## Where the secrets live

**Every production value in `server/.env` and `client/.env` must also be stored
in the team password manager** (one entry, e.g. "AssetTrack production .env",
holding the full file). The VM is not a backup: if it is the only copy and the
VM is lost, sign-in breaks and the database password has to be reset.

Store there too: the Supabase project ref and dashboard owner, the Google OAuth
client (Cloud project name + client ID), the backup encryption passphrase
(see [Backups](#backups)), the uptime monitor and Sentry account owners, and
the VM provider login. Update the entry whenever a value changes.

---

## Deploy

Run on the VM as the user that owns the checkout and runs PM2:

```bash
cd /var/www/assettrack
scripts/deploy.sh                 # deploys origin/main
scripts/deploy.sh <tag|commit>    # a specific version
```

What it does: `git fetch`, checks out the ref (detached HEAD), checks the
database for pending migrations, `npm ci` for server and client, builds the
web app, swaps the new build into `client/dist`, exports `GIT_COMMIT`, runs
`pm2 reload ecosystem.config.js --update-env`, then polls `/api/health` until
it reports the new commit. Deploys are logged to `logs/deploys.log`.

**Migrations.** If the release contains migrations the database does not have,
the script lists them and stops (exit code 2) without changing anything.
Review the SQL, then:

```bash
scripts/deploy.sh --migrate       # backs up the DB, applies migrations, then deploys
```

Migrations are applied **before** the new code starts, and the old code keeps
running against the new schema for a few seconds — so every migration must be
backwards compatible (add first; drop/rename only in a later release).

**If the new version does not become healthy** within 90 s (`--timeout` to
change), the script rebuilds and reloads the previous commit automatically and
exits non-zero. Migrations it applied are **not** undone (see below).

Expect a few seconds of API downtime per deploy (single PM2 instance). Users
with the app open keep working; a page reload picks up the new web app because
`index.html` is served `no-cache`.

## Roll back a release

```bash
scripts/rollback.sh --list        # recent deploys and their previous commits
scripts/rollback.sh <commit>      # rebuild + reload that commit, wait for health
```

`rollback.sh` warns about migrations that are newer than the target commit:
they **stay applied**. Normally that is fine (migrations are additive). To undo
one deliberately:

1. Take a backup: `scripts/backup_db.sh`.
2. Find the matching file in `supabase/rollbacks/` (same timestamp) and read it.
3. Run it against production with `psql` (from a machine allowed by Supabase
   network restrictions), then delete its row from `app_migrations` so the
   migration tool sees it as pending again.

## Check which build is live

```bash
curl -s https://assettrack.yourcompany.com/api/health
# {"status":"ok","version":"1.0.0","commit":"<sha>","startedAt":"…","database":"connected"}
git -C /var/www/assettrack log -1 --oneline <sha>
```

`commit` comes from `GIT_COMMIT` (set by the deploy script via PM2) or, if
unset, from git in the checkout. `startedAt` shows when the API last
restarted. On the VM: `pm2 status`, `pm2 logs assettrack-api --lines 100`.

---

## The VM died

Expect **about 1–2 hours** with the password manager entry and DNS access at
hand (most of it is waiting for installs and DNS/TLS). Data is safe: it lives
in Supabase, not on the VM.

1. **Create a new VM** (Ubuntu LTS, 1 vCPU / 1–2 GB RAM is enough). Open only
   22 (restricted to admin IPs if possible), 80 and 443.
2. **Point DNS** for `assettrack.yourcompany.com` at the new IP (do this early;
   propagation takes time).
3. **Supabase network restrictions:** add the new VM's public IP (and remove
   the old one) — otherwise the API cannot reach the database.
4. **Install software:**
   ```bash
   # Node (version in .nvmrc), e.g. via nvm or NodeSource
   sudo apt install -y nginx git postgresql-client-17 certbot python3-certbot-nginx
   npm install -g pm2 && pm2 install pm2-logrotate
   ```
   (`postgresql-client-17` may need the PGDG apt repository.)
5. **Get the code:** `sudo mkdir -p /var/www && sudo chown $USER /var/www`,
   `git clone <repo> /var/www/assettrack` (use a read-only deploy key).
6. **Restore settings:** recreate `server/.env` and `client/.env` from the
   password manager entry; `chmod 600 server/.env`.
7. **nginx + TLS:** copy `nginx-security-headers.conf.example` to
   `/etc/nginx/snippets/assettrack-security-headers.conf`, install
   `nginx.conf.example` as the site (see its header), run
   get the certificate **before** enabling the HTTPS site (the config points
   at the certificate files, so `nginx -t` fails until they exist):
   `sudo systemctl stop nginx && sudo certbot certonly --standalone -d assettrack.yourcompany.com && sudo systemctl start nginx`
   (certbot's renewal timer is installed automatically). Then enable the site,
   `sudo nginx -t && sudo systemctl reload nginx`.
8. **Start the app** (first-time note: rolling back to a version older than the deploy scripts removes `scripts/deploy.sh` from the checkout — run `git checkout main` before the next deploy): `scripts/deploy.sh` (it builds, starts PM2 and checks
   health). Then `pm2 startup` (run the command it prints) and `pm2 save` so
   the API starts on boot.
9. **Backups:** reinstall the cron job and off-site copy ([Backups](#backups)).
10. **Verify:** `/api/health` shows `database: connected`; sign in with
    Google; the uptime monitor turns green.

## Restore from backup

Two options. Prefer Supabase point-in-time recovery (PITR) for "undo the last
hours"; use a `pg_dump` file for anything else or if PITR is not enabled.

**Supabase PITR** (paid add-on; Dashboard → Database → Backups → Point in
time): pick a timestamp just before the problem. It restores the whole project
in place, so everything written after that time is lost — note what users
did since, and announce downtime. Stop the API first (`pm2 stop assettrack-api`)
and start it afterwards.

**From a dump** (`scripts/backup_db.sh` output, custom format):

1. Get the file (local `/var/backups/assettrack/` or the off-site copy;
   decrypt it if encrypted).
2. Restore into an **empty** database first — a scratch Supabase project or a
   local Postgres 17 — and check it:
   ```bash
   pg_restore --no-owner --no-privileges -d "$SCRATCH_DATABASE_URL" assettrack_<timestamp>.dump
   ```
3. For production: `pm2 stop assettrack-api`, take a fresh backup of the
   current state (even if broken), then either restore specific tables
   (`pg_restore -t <table> …`) or, for a full restore, reset the `public`
   schema in a new Supabase project and point `DATABASE_URL` at it. Re-apply
   any migrations newer than the dump with `node server/scripts/migrate.js apply --yes`.
4. Start the API and verify.

---

## Backups

Supabase takes daily backups on paid plans; ours are an independent second
copy we control.

**Daily dump on the VM** (crontab of the deploy user, `crontab -e`):

```cron
# AssetTrack DB backup, 02:00 every day
0 2 * * * /var/www/assettrack/scripts/backup_db.sh >> /var/www/assettrack/logs/backup.log 2>&1
```

The script reads `DATABASE_URL` from `server/.env`, writes
`/var/backups/assettrack/assettrack_<timestamp>.dump` (mode 600) and deletes
dumps older than `RETENTION_DAYS` (default 30). Needs `pg_dump` 17+.

**Off-site copy, encrypted.** A dump contains every employee's personal data;
it must not leave the VM unencrypted. Example with
[rclone](https://rclone.org/) and a `crypt` remote layered over S3 or Google
Drive (set up once with `rclone config`; the crypt passwords go in the password
manager):

```cron
# Copy new dumps off-site at 02:30; the remote keeps 90 days (lifecycle rule)
30 2 * * * rclone copy /var/backups/assettrack assettrack-crypt:db --max-age 48h >> /var/www/assettrack/logs/backup.log 2>&1
```

Alternatives: `gpg --symmetric --cipher-algo AES256` before `aws s3 cp`, or an
S3 bucket with server-side encryption and a lifecycle rule. Either way set
expiry to **30–90 days** (see the retention doc) and restrict access to the
bucket/folder to the owner.

**Monthly restore test** (first working day; ~20 minutes; record the date and
result in the team tracker):

1. Download the latest off-site dump and decrypt it (proves the off-site copy
   and the passphrase work).
2. Start a throwaway Postgres 17 (e.g. `npm run db --prefix server` on a dev
   machine with `DEV_DB_PORT=54399`, or a scratch Supabase project) and
   restore with `pg_restore --no-owner --no-privileges`.
3. Check row counts: `SELECT count(*) FROM employees; … FROM assets; … FROM asset_history;`
   roughly match production, and the newest `asset_history.created_at` is from
   the day before.
4. Drop the scratch database and delete the downloaded file.

If any step fails, fix it that week — an untested backup is not a backup.

---

## Rotate secrets

Rotate when someone with access leaves, a value may have leaked, or yearly.
After each change: update the password manager entry, then
`pm2 reload ecosystem.config.js --update-env` (or redeploy) and check
`/api/health` and sign-in.

**Database password (Supabase):** Dashboard → Project Settings → Database →
Reset database password. Update `DATABASE_URL` in `server/.env` (and any
`server/.env.supabase.local` used for migrations), reload PM2. The API is
unable to connect between the reset and the reload, so do it quickly or in a
quiet hour.

**Google OAuth client:** the ID token flow uses only the client **ID** (public),
but if the client is compromised or recreated: Google Cloud Console → APIs &
Services → Credentials → create a new OAuth client (Web) with the production
origin under Authorized JavaScript origins. Set `GOOGLE_CLIENT_ID` in
`server/.env` and `VITE_GOOGLE_CLIENT_ID` in `client/.env` to the new ID —
they must match — then run `scripts/deploy.sh` (the web app must be rebuilt).
Delete the old client afterwards.

**SMTP credentials (once email is enabled):** create a new app password / API
key at the mail provider, update the SMTP settings in `server/.env`, reload,
send a test email, then revoke the old credential.

**Sessions:** to sign everyone out (e.g. after a suspected account takeover),
delete rows from the `sessions` table; users simply sign in again.

**Deploy key / VM SSH keys:** remove departed people's keys from
`~/.ssh/authorized_keys` and the GitHub deploy keys.

---

## Monitoring

**Uptime.** Create an HTTP monitor in UptimeRobot or Better Stack (free tiers
are enough) on `https://assettrack.yourcompany.com/api/health`, every 1–5
minutes, alerting when the status is not 200 **or** the body does not contain
`"database":"connected"` (keyword monitor). Alerts must go to a named person
(email + phone/app push), not only a shared inbox. Add a second monitor on
`/` to catch nginx/TLS problems and enable certificate-expiry alerts.

**Errors (Sentry, optional).** Create a Sentry project for the API (Node) and
one for the web app (React). Set `SENTRY_DSN` in `server/.env` and
`VITE_SENTRY_DSN` in `client/.env`, then deploy (the web app reads its value
at build time). Both are optional: unset means no reporting. When the client
DSN is set, add the Sentry ingest host to `connect-src` in the CSP snippet
(`nginx-security-headers.conf.example`). Set up an alert rule that emails the
owner on new issues. The API strips request bodies, cookies, query strings,
IP addresses, user details and anything that looks like a password or token
before an event leaves the server (server/sentry.js, with a test); the web
app sends no personal data either (see the privacy doc).

**Logs.** PM2 writes `logs/api-out.log` and `logs/api-err.log`, rotated by
pm2-logrotate (production_checklist.md). `LOG_LEVEL` (e.g. `info`, `debug`)
changes verbosity; reload PM2 after changing it.

---

## Supabase settings checklist (manual)

These are dashboard settings — no code or migration can set them. Owner to
complete once and re-check quarterly.

- [ ] **Network restrictions** (Project Settings → Database → Network
      restrictions): allow only the VM's public IP. If migrations or backups are
      run from a dev machine, add that IP too (note it here with the person's
      name) and remove it when no longer needed.
- [ ] **Enforce SSL** on incoming connections (Database → SSL configuration).
      Optionally download the CA certificate and set `DATABASE_SSL_CA_FILE`
      (and `DATABASE_SSL_REQUIRE_CA=true` to refuse to start without it).
- [ ] **Point-in-time recovery** enabled (Database → Backups), at least 7 days.
- [ ] **Spend cap / usage alerts** set (Organization → Billing) so a runaway
      cost or quota emails the owner.
- [ ] **Data API**: AssetTrack does not use Supabase's REST/GraphQL API. Disable
      it (Project Settings → API) if available; otherwise rely on RLS —
      migration `20261008100000_lock_down_public_schema.sql` enables row level
      security on every table and revokes the `anon` and `authenticated` roles,
      so the public API key reads nothing. Never share the `service_role` key.
- [ ] **Dashboard access**: only the people who need it are project members;
      two-factor authentication on their Supabase accounts.
