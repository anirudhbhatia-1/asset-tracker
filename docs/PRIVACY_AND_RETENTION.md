# AssetTrack — Employee Data Privacy Notice and Retention Rules

> **DRAFT for HR / legal review — not legal advice.** Written by the
> engineering team to describe what the application actually stores and to
> propose rules. HR and legal must review it against the Digital Personal Data
> Protection Act, 2023 (DPDP Act) and the DPDP Rules in force, adjust it, and
> decide how it is communicated to employees. Items marked **[DECIDE]** need an
> owner's decision. Nothing here has been implemented as automatic deletion yet.

Last updated: 2026-10-08 · Owner: **[DECIDE: name, role]**

## 1. Scope

AssetTrack is Thinkvibes' internal tool for tracking company and client
hardware, support tickets, and employee onboarding/offboarding. It processes
**digital personal data of employees** (current, joining and former) within
the meaning of the DPDP Act. Thinkvibes is the **Data Fiduciary**. Supabase
(database hosting) and the VM/hosting provider act as processors; Google
provides sign-in (Google Workspace); Sentry, if enabled, receives error
reports.

## 2. What personal data the app stores

| Data | Where (tables) | Source |
|---|---|---|
| Name, work email, department | `employees` | HR / admins, Google Workspace profile |
| Office location and postal address (for equipment delivery) | `employees.location`, `employees.address`, `onboarding_requests.address` | HR / the employee |
| Work mode (office / hybrid / remote) | `employees.work_mode` | HR / admins |
| Google account ID and profile photo URL | `employees.google_id`, `avatar_url` | Google sign-in |
| Login data: password hash (bcrypt), role, failed-login count, time of the last failed sign-in, lockout time, session tokens (stored hashed) | `employees`, `sessions` | The app |
| Assets and bulk items held, with dates and serial numbers | `assets`, `asset_history`, `stock_holdings`, `stock_history` | IT / hardware admins |
| Support tickets: description, status, who handled them | `tickets`, `ticket_history` | The employee, admins |
| Onboarding: joining date, requested equipment, notes | `onboarding_requests`, `onboarding_request_items` | HR |
| Offboarding: last working day, **exit reason** (resignation, termination, contract end, retirement, other), notes, returned/missing items | `offboarding_requests`, `offboarding_items` | HR / IT |
| Access history: who granted/changed access, roles, passwords, lockouts, and who exported/imported data, with IP address | `access_audit` | The app |
| Server logs (request method, path, status, timing; no request bodies) | PM2 log files on the VM | The app |

Not collected: government IDs, bank details, health data, personal phone
numbers. Free-text fields (ticket descriptions, notes) must not be used for
such data — **[DECIDE]** include this in admin guidance.

Exit reason and notes are the most sensitive fields; keep notes factual and
minimal.

## 3. Purposes

1. Tracking who holds which company or client equipment and its history
   (accountability, audits, client obligations).
2. Delivering and recovering equipment (joining, remote work, exit).
3. Handling IT, hardware and HR support requests.
4. Securing the app: sign-in, access control, detecting misuse.
5. Producing inventory reports and exports for finance/audit.

Data is not used for performance evaluation, profiling or marketing, and is
not sold or shared outside the processors above. **[DECIDE]** confirm the
lawful basis HR relies on (employment purposes under the DPDP Act's legitimate
uses, and/or notice + consent at joining).

## 4. Who can see and export it

Access is by role permission (Settings → Roles). Directors hold every
permission. Role contents can be changed in the app, so the right-hand column
is indicative only — **[DECIDE]** record the actual role list here after review.

| Permission | What it allows | Typically held by (verify in Settings → Roles) |
|---|---|---|
| `employees:read` | View the employee directory (name, email, department, location, work mode, address) and who holds what | Director, Admin, HR |
| `employees:create/update/delete/manage` | Add, edit, remove employees; grant logins and roles | Director, HR / Admin as configured |
| `assets:read`, `history:read` | View assets, their holders and assignment history | Director, Admin, HR |
| `assets:export` | Download the Excel/CSV export, which includes holders' names and emails | Director, Admin |
| `tickets:read` | View tickets in the user's queue | Admins per queue; employees see their own |
| `onboarding:read`, `offboarding:read` | View joining / exit records, including exit reason | Director, HR, Admin as configured |
| `audit:read` | View the access history (who changed access, who exported data) | Director only by default |

Every employee can see their own profile, assets and tickets.

Review the role list **[DECIDE: quarterly]** and remove permissions people no
longer need.

**Exports are logged.** Each export (and import) is recorded in the access
history with who did it, when, from which IP, and what was exported. Exported
files contain personal data: store them only on company systems, share them
only with people who need them, and delete them when done. Do not commit them
to the code repository (the repository ignores `*.xlsx`/`*.csv`).

## 5. Retention (proposal)

| Data | Proposed rule |
|---|---|
| Active employees | Kept while employed. |
| Offboarded / removed employees — personal fields (email, address, location, Google ID, photo, password hash, work mode, department) | **Anonymised [DECIDE: 6 / 12] months after the last working day** (or removal if no exit record). Name replaced by a pseudonym such as `Former employee #1234`. Sessions deleted at exit. |
| Asset and stock history, tickets, onboarding/offboarding records | Kept for equipment audit and client obligations **[DECIDE: e.g. 7 years for finance/audit]**, but linked only to the pseudonym after anonymisation. Free-text notes on exit records cleared at anonymisation. |
| Access history (`access_audit`) | **[DECIDE: 2–3 years]**, then deleted. Actor/target names are snapshots and are pseudonymised with the employee record. |
| Database backups (`scripts/backup_db.sh`, off-site copies) | Expire after **30–90 days [DECIDE]** (local default 30 days; off-site lifecycle rule). Anonymisation reaches backups when old backups expire. |
| Supabase point-in-time recovery | Provider window (e.g. 7 days). |
| Server logs | Rotated by pm2-logrotate; **[DECIDE: 30 days]**. |
| Error reports (Sentry, if enabled) | Provider retention, set to **[DECIDE: 30–90 days]**. |
| Exports downloaded by staff | Deleted by the person who downloaded them once the purpose is met. |

Implementation status: anonymisation is **not yet automated**. Until it is,
HR/IT run it manually **[DECIDE: quarterly]**. An engineering task should add a
script that anonymises employees past the retention period (keeping their
IDs so history rows stay intact) and logs each run in the access history.

## 6. Employees' rights and requests

Under the DPDP Act employees may ask to access a summary of their data,
correct it, have it erased where it is no longer needed for the purposes above
(subject to legal/audit retention), and nominate someone to act for them.
Requests go to the grievance contact below and are answered within
**[DECIDE: e.g. 30 days]**. Corrections to name, department, location, address
or work mode can be made by HR in the app.

## 7. Security measures (summary)

HTTPS only; sign-in with Google Workspace or bcrypt-hashed passwords with
lockout; permission checks on every API call; database reachable only from the
application server (Supabase network restrictions, SSL); row level security on
all tables with the public Data API roles revoked; access and exports logged;
encrypted off-site backups with expiry. See [RUNBOOK.md](RUNBOOK.md).

**Personal data breach:** inform the grievance owner immediately; they decide
on notification to the Data Protection Board of India and affected employees
as the DPDP Act and Rules require **[DECIDE: internal escalation steps]**.

## 8. Contact / grievance officer

Name: **[DECIDE]** · Role: **[DECIDE]** · Email: **[DECIDE, e.g. privacy@…]**
