# AssetTrack — IT Asset Management & Service Portal

Internal web app for Thinkvibes: hardware inventory (company- and client-owned),
assignment and audit history, IT/Hardware/HR support tickets, and HR onboarding and offboarding.

## Stack

| Part | Technology |
|---|---|
| Frontend (`client/`) | React 19, Vite 8, React Router 7, Tailwind CSS 4, lucide-react, axios, react-hot-toast |
| Backend (`server/`) | Node 20.19+, Express 5, `pg` (raw parameterized SQL, no ORM), express-validator, express-rate-limit, bcrypt, exceljs, multer, google-auth-library |
| Database | Supabase Postgres 17 in production; embedded PostgreSQL 17 (`embedded-postgres`) for local development |
| Tests | Vitest + Supertest (server), Vitest (client), Playwright (end-to-end) |

Frontend code follows **API layer → hooks → components**: `client/src/api/*` wraps
axios, `client/src/hooks/*` handle loading/error state, pages and components render.
Backend code follows **routes → services**: routes validate input and check
permissions, services hold the business logic and SQL.

## Getting started

Requirements: Node.js 20.19+ (see `.nvmrc`) and npm.

```bash
npm install && npm install --prefix server && npm install --prefix client
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev                                  # local database + API (3001) + web (5173)
```

Open http://localhost:5173.

`npm run dev` starts three processes:

- **DB** — a real PostgreSQL 17 server on `127.0.0.1:54322`, stored in
  `server/.devdb-pg/` (git-ignored; no Docker or Homebrew needed). On first run
  it applies every file in `supabase/migrations/` and seeds categories,
  locations and test accounts. New migration files are applied automatically on
  the next start. (`server/.devdb/` is data from the old PGlite setup and can be
  deleted.)
- **SERVER** — the Express API on port 3001 (nodemon).
- **CLIENT** — Vite on port 5173, proxying `/api` to the API.

Development never touches production data: `server/.env` points at the local
database. Keep the production connection string out of development settings —
the server tests refuse to run against a non-local database.

### Local test accounts

All use the password `password`. They exist **only in the local database**.

| Email | Role |
|---|---|
| admin@company.com | Director (all permissions) |
| itadmin@company.com | Admin, IT queue |
| hardwareadmin@company.com | Admin, Hardware queue |
| hr@company.com | HR |
| employee@company.com | Employee |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local DB + API + web app |
| `npm run db:reset` | Wipe and rebuild the local database, then start it |
| `npm test` | Server tests (needs the local database running) |
| `npm run test:client` | Client unit tests |
| `npm run test:all` | Server and client unit tests |
| `npm run test:e2e` | End-to-end tests, one at a time (reuses a running `npm run dev`, or starts one); removes the data they create afterwards |
| `npm run lint` | Lint the web app (oxlint) |
| `npm run build` | Production build of the web app into `client/dist` |
| `npm run migrate:status --prefix server` | Which migrations a database has / is missing |
| `npm run migrate:apply --prefix server` | Apply pending migrations (see Database changes) |
| `scripts/deploy.sh [ref] [--migrate]` | Production deploy on the VM (see Deployment) |
| `scripts/rollback.sh <commit>` | Put an earlier commit back live on the VM |
| `scripts/backup_db.sh` | `pg_dump` of the production database (run daily from cron) |

CI (`.github/workflows/ci.yml`) runs on every push and pull request: lint,
client tests, the build and the server tests against a fresh local
PostgreSQL; `npm audit --omit=dev --audit-level=high` for server and client
(fails on high/critical advisories in production dependencies); and the
Playwright end-to-end suite in Chromium (the HTML report is uploaded as an
artifact when it fails). Dependabot (`.github/dependabot.yml`) opens weekly,
grouped dependency update PRs for root, server, client and GitHub Actions.

## Configuration

Server settings live in `server/.env` (see `server/.env.example` and
`server/.env.production.example`). On hosting platforms, set them as
environment variables instead.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Supabase **session pooler**, port 5432, in production) |
| `NODE_ENV` | `production` in production (enables SSL to the database, strict Google settings) |
| `PORT` | API port (default 3001) |
| `CLIENT_ORIGIN` | Web app origin allowed by CORS |
| `TRUST_PROXY_HOPS` | Set to `1` behind a single reverse proxy so rate limits see real client IPs |
| `GOOGLE_CLIENT_ID` | Google sign-in client ID; must equal the client's `VITE_GOOGLE_CLIENT_ID` |
| `GOOGLE_ALLOWED_DOMAIN` | Workspace domain allowed to sign in with Google, e.g. `thinkvibes.com` (required in production unless `GOOGLE_ALLOW_EXTERNAL_ACCOUNTS=true`) |
| `LOGIN_EMAIL_DOMAINS` | Comma-separated domains that may be given a login (default `company.com,thinkvibes.com`) |
| `DATABASE_SSL_CA_FILE` | Optional path to Supabase's CA certificate to verify the database certificate |
| `DB_POOL_MAX` | Optional database pool size (default 10) |
| `HOST` | Optional bind address; set `127.0.0.1` on a VM behind nginx, leave unset on hosting platforms |
| `APP_TIMEZONE` | Business timezone for "today" defaults (default `Asia/Kolkata`) |
| `DEV_DB_PORT` | Local database port (default 54322) |
| `DATABASE_SSL_REQUIRE_CA` | `true` makes the API refuse to start in production without `DATABASE_SSL_CA_FILE` (otherwise it only warns) |
| `DB_CONNECT_TIMEOUT_MS` | Optional database connection timeout (default 10000) |
| `API_RATE_LIMIT_PER_MINUTE` | Optional: requests per minute per signed-in session (default 600) |
| `API_RATE_LIMIT_ANON_PER_MINUTE` | Optional: requests per minute per IP without a session (default 300) |
| `API_RATE_LIMIT_IP_PER_MINUTE` | Optional: ceiling on all requests per IP per minute (default 1200) |
| `DB_STATEMENT_TIMEOUT_MS` | Optional: longest a single database query may run (default 30000) |
| `LOGIN_FAILURE_MIN_MS` | Optional: minimum time a failed sign-in takes, so timing reveals nothing (default 350) |
| `LOG_LEVEL` | Optional log level (`error`, `warn`, `info`, `debug`; default `info`). Logs are JSON lines |
| `SENTRY_DSN` | Optional: report API errors to Sentry. Unset = no reporting |
| `GIT_COMMIT` | Commit reported by `GET /api/health`; set by `scripts/deploy.sh` through PM2 (falls back to `git rev-parse`) |
| `ALLOW_REMOTE_DB_TESTS` | Set to `1` only to deliberately run the server tests against a non-local database |

Client settings (`client/.env`, read at build time): `VITE_API_BASE_URL`
(default `/api`), `VITE_GOOGLE_CLIENT_ID`, and optionally `VITE_SENTRY_DSN`
(report web-app errors to Sentry; the deploy script also sets
`VITE_GIT_COMMIT` so reports are tagged with the release).

`GET /api/google/config` reports whether Google sign-in is enabled and, if not,
which setting is missing. The API also logs this at startup.

## Security model

- Login by email/password (bcrypt, email case-insensitive) or Google (ID token
  verified server-side). Only employees who were granted access (they have a
  role) can log in; plain directory entries cannot. Sessions are random tokens
  stored as SHA-256 hashes, valid 8 hours; changing a password, role or email
  signs that user out. Password login and password changes are limited to 10
  failed attempts per 15 minutes per address. On top of that, 20 wrong
  passwords for one account within an hour lock that account's password
  sign-in for 15 minutes (Google sign-in still works; an admin can unlock it
  from Employees). While locked, a wrong password gets the normal "Invalid
  email or password" — only the correct password is told the account is
  locked — and every failed sign-in takes the same minimum time, so neither
  reveals which emails have accounts. The server log records the real reason
  for each failed sign-in.
- New passwords: 10–128 characters, not a common password, not containing
  the person's name or email name, not one repeated character.
- Temporary passwords (and accounts flagged `must_change_password`) must be
  replaced before anything else: the API answers other calls with 403
  `PASSWORD_CHANGE_REQUIRED` and the app shows a set-new-password screen.
- Permissions are keys such as `assets:read` or `tickets:resolve`, grouped into
  roles (Director, Admin, HR, Employee, plus custom roles) in the `roles`,
  `permissions` and `role_permissions` tables. Directors bypass all checks.
  Nobody can grant a role with permissions they do not hold themselves, and only
  Directors can create or manage Directors.
- Ticket updates are limited to the ticket's own queue; resolving or rejecting
  requires `tickets:resolve`; status changes follow fixed rules. Resolving with
  an asset, or fulfilling an onboarding item, only accepts available stock and
  never takes a device from someone else.
- Removing an employee is refused while they still hold assets.

## Domain rules

- Asset statuses: `available`, `in-use`, `retired`, and `returned` (client-owned
  assets handed back to the client). Client-owned assets are kept for their
  records but excluded from company totals, category counts and assignment
  pickers; Inventory has a Company / Client / All switch.
- Every lifecycle change is written to `asset_history` in the same transaction.
  History is never deleted — deleting an asset keeps its history rows.
- Accessories (`parent_id`, e.g. adaptors) follow their laptop when it is
  assigned or returned, and are released when it is retired.
- Costs are stored in paise (`cost_cents`) and shown in rupees.
- Onboarding requests are linked to the new hire by email; fulfilled assets are
  assigned automatically once the employee record exists.
- Offboarding (employee exit): HR starts an exit with a last working day; the
  checklist lists every asset the employee holds and stays in sync with
  assignments made or returned elsewhere. IT marks each item *returned* (back
  to stock, or to the client; attached accessories come back with it) or
  *missing* (the asset is retired), with the same rights as returning or
  retiring from Inventory. Completing requires every item to be handled and,
  in one step, can revoke the login and remove the employee from the
  directory. One open exit per employee; the person leaving cannot change it.
  Permissions: `offboarding:read`, `:create`, `:update`, `:collect`.
- Employees have a work mode — `office` (default), `hybrid` or `remote` —
  set by HR/Admin and filterable on the Employees page.
- Bulk items without serial numbers (bags, cables, mouse pads) are kept as a
  count in `stock_items`; `stock_holdings` records who has how many, and in
  stock = total − handed out. Assign / return / write off (lost or broken,
  the total drops) are logged in `stock_history`. They use the asset
  permissions (`assets:read/create/update/assign/delete`), are separate from
  serialized asset totals, and are not on the offboarding checklist. An item
  can be removed only when nobody holds any.

## Bulk data

- **Excel** (Inventory → Import/Export): the legacy 4-sheet workbook
  (Laptops, Headphones, Keyboard Mouse, Client Laptops). Import maps sheet
  types to categories, reads free-text statuses, generates serials for "NA",
  and records handovers when a serial repeats.
- **CSV** (Add Asset → Bulk upload): one asset per row using the template at
  `client/public/asset-import-template.csv`. The file is checked first and
  nothing is saved until you confirm.

## API

All routes are under `/api` and, except auth/Google/health, require
`Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `PATCH /auth/change-password`, `GET /google/config`, `POST /google/login` |
| Assets | `GET /assets` (filters: `q`, `status`, `categoryId`, `location`, `warranty`, `assetType`, `parentId`), `POST /assets`, `GET/PATCH/DELETE /assets/:id`, `POST /assets/:id/assign`, `POST /assets/:id/return`, `POST /assets/:id/retire`, `GET /assets/:id/history`, `GET /assets/:id/tickets`, `GET /assets/serial-exists`, `GET /assets/export`, `POST /assets/import`, `POST /assets/import-csv?dryRun=true` |
| Scanner | `GET /serial/scan/:serial` (rate-limited) |
| Employees | `GET /employees`, `GET /employees/departments`, `GET/PATCH /employees/me`, `GET/PATCH/DELETE /employees/:id`, `GET /employees/:id/assets`, `POST /employees`, `PATCH /employees/:id/role`, `POST /employees/:id/grant-access`, `POST /employees/:id/grant-google-access` (not in production), `POST /employees/:id/assign-assets` |
| Roles | `GET/POST /roles`, `GET/PUT/DELETE /roles/:id` |
| Categories & locations | `GET/POST /categories`, `GET/PUT/DELETE /categories/:id`, `GET/POST /locations`, `PUT /locations/:id/addresses` |
| Tickets | `GET/POST /tickets`, `GET/PATCH /tickets/:id`, `GET /tickets/:id/history`, `PATCH /tickets/:id/transfer`, `PATCH /tickets/:id/confirm-close`, `PATCH /tickets/:id/reopen` |
| Onboarding | `GET/POST /onboarding`, `GET /onboarding/hr-metrics`, `GET/PUT /onboarding/:id`, `PUT /onboarding/:id/status`, `PATCH /onboarding/:id/items/:itemId/fulfill` |
| Bulk items | `GET/POST /stock`, `GET/PATCH/DELETE /stock/:id`, `POST /stock/:id/adjust`, `POST /stock/:id/assign`, `POST /stock/:id/return`, `POST /stock/:id/write-off`, `GET /stock/mine`, `GET /stock/holdings/:employeeId` |
| Offboarding | `GET/POST /offboarding`, `GET/PUT /offboarding/:id`, `PATCH /offboarding/:id/items/:itemId`, `POST /offboarding/:id/complete`, `POST /offboarding/:id/cancel` |
| Other | `GET /history`, `GET /notifications`, `GET /health` |

Responses use `{ data, message }` (lists add `total`); errors use
`{ error: true, message, code }` (plus `details` when there is more to say,
e.g. the assets blocking an employee's removal). Database input errors return
400/409; unexpected errors return 500 with a generic message in production.

## Database changes

Schema changes are SQL files in `supabase/migrations/`, named
`YYYYMMDDHHMMSS_description.sql` (never date a file in the future). Every
database records the files it has in an `app_migrations` table, so nothing is
applied twice. The local database applies new files on start.

For production (take a backup with `scripts/backup_db.sh` first):

```bash
cd server
node scripts/migrate.js status --env-file .env.supabase.local
node scripts/migrate.js apply --env-file .env.supabase.local --yes
```

`--env-file` points at a file holding the production `DATABASE_URL` (keep it
git-ignored, e.g. `server/.env.supabase.local`); remote databases need `--yes`.
A database migrated before this tool existed is first recorded with
`baseline --through <last file it already has>`. `supabase/rollbacks/` holds
manual undo scripts that are never applied automatically.

## Deployment

Production runs on one VM: nginx serves `client/dist` and proxies `/api` to the
API under PM2 (`ecosystem.config.js`), with Supabase Postgres as the database.
Work through [production_checklist.md](production_checklist.md) before going
live; day-to-day operations are in the [runbook](docs/RUNBOOK.md).

- **Deploy:** `scripts/deploy.sh` on the VM (default `origin/main`; pass a tag
  or commit to choose). It installs, builds, reloads PM2 with `GIT_COMMIT` and
  waits for `/api/health` to report the new commit, rolling back automatically
  if it does not. Pending migrations stop the deploy until you re-run with
  `--migrate` (backup first, then apply, then release). Migrations are never
  rolled back automatically.
- **Roll back:** `scripts/rollback.sh <commit>` (`--list` shows recent deploys).
- **Which build is live:** `GET /api/health` returns
  `{ status, version, commit, startedAt, database }`.
- **nginx:** `nginx.conf.example` + `nginx-security-headers.conf.example`
  (security headers on every response, hashed `/assets/*` cached for a year,
  `index.html` revalidated so deploys show up immediately).
- **Monitoring:** an uptime monitor on `/api/health` alerting a person, and
  optional Sentry (`SENTRY_DSN`, `VITE_SENTRY_DSN`) — see the runbook.
- **Backups:** `scripts/backup_db.sh` daily from cron, encrypted off-site copy,
  monthly restore test, plus Supabase point-in-time recovery — see the runbook.
- **Personal data:** [docs/PRIVACY_AND_RETENTION.md](docs/PRIVACY_AND_RETENTION.md)
  (draft for HR/legal review) lists what employee data is stored, who can see
  or export it, and the proposed retention rules.

## Project structure

```
client/            React app (api/, hooks/, components/, pages/, utils/)
server/            Express API (routes/, services/, middleware/, scripts/, tests/)
supabase/          migrations/ (schema history) and rollbacks/
e2e/               Playwright tests
scripts/           deploy.sh, rollback.sh, backup_db.sh (VM operations)
docs/              runbook, privacy draft, design specs and guides (index: docs/README.md)
```

The planning documents in `docs/` (`AssetTrack_*.md`, `LEARN.md`,
`migration_notes.md`) describe the original plan and may not match the current
code; this README is the source of truth.
