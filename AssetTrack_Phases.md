# AssetTrack — Project Phases & Delivery Plan

**Document Version:** 1.0  
**Date:** July 21, 2026  
**Status:** Draft — Pending Engineering Lead Sign-Off  
**Owner:** Engineering Lead / Project Manager  

---

## Table of Contents

1. [Overview & Timeline](#1-overview--timeline)
2. [Team & Roles (RACI)](#2-team--roles-raci)
3. [Phase 1 — MVP Core](#3-phase-1--mvp-core) *(Weeks 1–6)*
4. [Phase 2.0 — Migrate to Supabase](#4-phase-20--migrate-to-supabase) *(Mid-Phase 2)*
5. [Phase 2 — Scanner & Google Sync](#5-phase-2--scanner--google-sync) *(Weeks 7–10)*
6. [Phase 3 — Polish & Settings](#6-phase-3--polish--settings) *(Weeks 11–12)*
7. [Phase 4 — Post-Launch v1.1](#7-phase-4--post-launch-v11) *(Weeks 13+)*
8. [Master Gantt Summary](#8-master-gantt-summary)
9. [Dependencies & Blockers](#9-dependencies--blockers)
10. [Risk Register](#10-risk-register)
11. [Definition of Done](#11-definition-of-done)

---

## 1. Overview & Timeline

| Phase | Name | Duration | Target End Date | Goal |
|---|---|---|---|---|
| **Phase 1** | MVP Core | 6 weeks | Week 6 | Working inventory system with assignment and audit log |
| **Phase 2.0** | Migrate to Supabase | - | Mid-Phase 2 | Transition SQLite to Supabase Postgres |
| **Phase 2** | Scanner & Google Sync | 4 weeks | Week 10 | Barcode scanner + Google Workspace integration live |
| **Phase 3** | Polish & Settings | 2 weeks | Week 12 | Production-ready: responsive, accessible, tested |
| **Phase 4** | Post-Launch v1.1 | Ongoing | Week 13+ | Feature enhancements based on user feedback |
| **Phase 5** | RBAC, Ticketing, Onboarding | 2 weeks | Week 15 | Multi-role access, employee requests, HR onboarding workflows |

**Total to production-ready v1.0:** ~12 weeks  
**Stack:** React (Vite) + Node.js/Express + Supabase Postgres  

---

## 2. Team & Roles (RACI)

| Task Area | Engineering Lead | Frontend Dev | Backend Dev | IT Admin | QA |
|---|---|---|---|---|---|
| Architecture decisions | **R/A** | C | C | I | I |
| Frontend components | A | **R** | I | I | C |
| Backend API & services | A | I | **R** | I | C |
| Database schema & migrations | **R/A** | I | C | I | I |
| Google OAuth setup | A | C | **R** | **R** | I |
| QA & testing | A | C | C | I | **R** |
| Production deployment | **R/A** | I | C | C | I |
| Documentation | A | C | C | I | C |

> **R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

---

## 3. Phase 1 — MVP Core

**Duration:** 6 weeks (Weeks 1–6)  
**Goal:** A fully functional asset management system that an IT admin can use to register assets, assign them to employees, view the inventory, and see a complete audit history — without the scanner or Google sync features.

---

### Phase 1 Objectives

- [x] Project scaffold and development environment working for all developers.
- [x] SQLite database schema created with seed data.
- [x] All backend REST API endpoints for assets, employees, categories, and history are functional.
- [x] Dashboard with live metrics and activity feed.
- [x] Inventory list with search and filters.
- [x] Asset detail page with specifications and history timeline.
- [x] Add new asset form with auto-serial generation.
- [x] Assignment modal with employee picker and date selection.
- [x] Employee directory grid with per-employee asset drawer.
- [x] All P0 features from the PRD are implemented and manually tested.

---

### Week 1 — Project Setup & Foundation

**Theme:** Get every developer running the same working environment.

#### Backend Tasks
- [x] Initialise Node.js + Express project in `server/` with `npm init`.
- [x] Install dependencies: `express`, `better-sqlite3`, `cors`, `dotenv`, `morgan`, `express-validator`.
- [x] Create `server/db.js` — SQLite connection, schema creation (`CREATE TABLE IF NOT EXISTS`), and seeder.
- [x] Create all 5 tables: `assets`, `employees`, `categories`, `asset_history`, `google_config`.
- [x] Create all indexes (see Architecture §5.4).
- [x] Write seed data: 4 categories, 8 employees across 4 offices, 15 sample assets with mixed statuses.
- [x] Create `server/index.js` — Express app with CORS, JSON parsing, morgan, and route mounting stubs.
- [x] Create `.env.example` with all required variables.
- [x] Verify server starts clean on `npm run dev` (nodemon).

#### Frontend Tasks
- [x] Initialise React + Vite project in `client/` using `npm create vite@latest`.
- [x] Install dependencies: `react-router-dom`, `axios`, `tailwindcss`, `lucide-react`, `date-fns`, `react-hot-toast`.
- [x] Configure Tailwind CSS with dark-mode theme tokens (see PRD §9.1 design tokens).
- [x] Import Inter font from Google Fonts in `index.html`.
- [x] Create base `App.jsx` with `BrowserRouter` and route stubs for all 8 pages.
- [x] Create `Sidebar.jsx` and `TopBar.jsx` layout components with placeholder nav links.
- [x] Create `axiosInstance.js` with base URL from env and placeholder interceptors.
- [x] Verify app loads at `http://localhost:5173` with sidebar visible.

#### Devops / Shared Tasks
- [x] Create root `README.md` with setup instructions (clone → install → seed → run).
- [x] Create `.gitignore` covering all excluded paths from Architecture §11.
- [x] Set up Git repository with `main` branch protection (require PR + review).
- [x] Create `feat/phase-1-setup` branch as the working branch.

**Week 1 Exit Criteria:**
- Server starts without errors and database file is created with seeded data.
- Frontend loads at localhost:5173 showing sidebar layout.
- All developers confirmed the setup works on their machines.

---

### Week 2 — Backend API: Assets & Employees

**Theme:** Build the complete REST API layer for core resources.

#### Assets API (`server/routes/assets.js` + `server/services/assetService.js`)
- [x] `GET /api/assets` — list all assets with optional query params (`?status=`, `?category_id=`, `?location=`, `?q=`).
- [x] `GET /api/assets/:id` — get single asset with full history and assignee details (JOIN query).
- [x] `POST /api/assets` — create asset; validate all required fields; log `created` history event.
- [x] `PUT /api/assets/:id` — update asset fields; log `updated` history event.
- [x] `DELETE /api/assets/:id` — log `deleted` event first, then hard delete.
- [x] `POST /api/assets/:id/assign` — set `status='in-use'`, record assignee, log `assigned` event. Use `db.transaction()`.
- [x] `POST /api/assets/:id/return` — set `status='available'`, clear assignee, log `returned` event.
- [x] `POST /api/assets/:id/retire` — set `status='retired'`, log `retired` event.
- [x] `GET /api/serial/scan/:serial` — look up asset by serial number.

#### Employees API (`server/routes/employees.js` + `server/services/employeeService.js`)
- [x] `GET /api/employees` — list all employees.
- [x] `GET /api/employees/:id` — get single employee.
- [x] `GET /api/employees/:id/assets` — get all assets currently assigned to this employee.
- [x] `POST /api/employees` — create employee manually.
- [x] `PUT /api/employees/:id` — update employee.
- [x] `DELETE /api/employees/:id` — soft delete (set `deleted_at` timestamp).

#### Categories & History APIs
- [x] `GET /api/categories` — list all.
- [x] `POST /api/categories` — create.
- [x] `PUT /api/categories/:id` — update.
- [x] `DELETE /api/categories/:id` — delete with conflict check.
- [x] `GET /api/history` — recent activity feed (last 20 events, reverse chronological).
- [x] `GET /api/assets/:id/history` — full history for one asset.

#### Middleware
- [x] Create `middleware/validateRequest.js` — reads `validationResult`, returns `400` with errors if any.
- [x] Create `middleware/errorHandler.js` — global error handler, formats `{ error, message, code }`.
- [x] Add `express-validator` rules to all POST/PUT routes.

**Week 2 Exit Criteria:**
- All API endpoints respond correctly when tested with a REST client (Postman / curl / Thunder Client).
- Assign + Return + Retire each trigger the correct history event in `asset_history`.
- 400 returned when required fields are missing; 404 when ID not found.

---

### Week 3 — Dashboard & Inventory Pages

**Theme:** Build the two most-visited pages with real data from the API.

#### Dashboard Page (`client/src/pages/DashboardPage.jsx`)
- [x] Create `useMetrics()` hook that fetches aggregate counts from `GET /api/assets`.
- [x] Build `MetricCard.jsx` — displays label, count, icon, and count-up animation on mount.
- [x] Render 4 metric cards: Total, In Use, Available, Retired.
- [x] Build `InventoryBreakdown.jsx` — fetches assets, groups by category, renders percentage bars.
- [x] Build `ActivityFeed.jsx` — fetches `GET /api/history`, renders reverse-chronological list with color-coded type tags.
- [x] Build `GoogleBanner.jsx` — placeholder banner showing "Google Workspace — Not Configured" with link to Settings.
- [x] Dashboard page assembles all 4 components in a responsive grid layout.

#### Inventory Page (`client/src/pages/InventoryPage.jsx`)
- [x] Build `SearchBar.jsx` — controlled input, debounced (300ms), updates URL query param `?q=`.
- [x] Build `FilterToolbar.jsx` — category chips + status dropdown. Active filters visually highlighted.
- [x] Create `useAssets()` hook — fetches from `GET /api/assets`, re-fetches when filters change.
- [x] Build `AssetTable.jsx` — renders table with all columns from PRD §6.2.3.
- [x] Build `AssetTableRow.jsx` — category badge icon, status pill, asset name link, action button.
- [x] Build `StatusPill.jsx` primitive — renders correct color based on status value.
- [x] Build `Badge.jsx` primitive — 1-char colored badge for category.
- [x] Wire asset name click to navigate to `AssetDetailPage` (`/inventory/:id`).
- [x] Implement empty state for no results with icon + message.
- [x] Implement loading skeleton rows while data is fetching.

**Week 3 Exit Criteria:**
- Dashboard loads with real counts from the seeded database.
- Activity feed shows the last 20 events in correct order.
- Inventory table shows all 15 seeded assets.
- Typing in search bar filters results in real-time (debounced).
- Clicking a category chip or status dropdown filters the table correctly.

---

### Week 4 — Asset Detail Page & Lifecycle Actions

**Theme:** Build the full asset detail view and all lifecycle controls.

#### Asset Detail Page (`client/src/pages/AssetDetailPage.jsx`)
- [x] Create `useAsset(id)` hook — fetches `GET /api/assets/:id` on mount and on any action.
- [x] Build `SpecsProfile.jsx` — displays all spec fields from PRD §6.3.1 with copy-to-clipboard on serial.
- [x] Build `HistoryTimeline.jsx` — chronological timeline of all `asset_history` events with icon, event type, date, assignee, and note.
- [x] Build `AssigneeCard.jsx` — shown only when status is `in-use`; displays employee details.
- [x] Build `LifecycleActions.jsx` — renders contextual action buttons (Assign, Return, Retire, Delete) based on current status.
- [x] Implement inline notes edit — click pencil icon, textarea appears, save triggers `PUT /api/assets/:id`.

#### Assignment Modal (`client/src/components/forms/AssignmentModal.jsx`)
- [x] Modal opens when "Assign" or "Reassign" is clicked.
- [x] Searchable employee list loaded from `GET /api/employees`.
- [x] Date picker for assignment date (defaults to today).
- [x] Optional notes field.
- [x] On submit: calls `POST /api/assets/:id/assign`, closes modal, refreshes asset detail.
- [x] If asset is already assigned, modal shows "Reassign" title and pre-populates current assignee.
- [x] Modal closes on Escape key and backdrop click.

#### Confirmation Dialogs
- [x] Build reusable `Modal.jsx` primitive with title, body slot, and configurable action buttons.
- [x] "Return to Stock" — confirmation modal → calls `POST /api/assets/:id/return`.
- [x] "Retire Asset" — confirmation modal with red confirm button → calls `POST /api/assets/:id/retire`.
- [x] "Delete Asset" — two-step confirmation (type asset name to confirm) → calls `DELETE /api/assets/:id`.

**Week 4 Exit Criteria:**
- Asset detail page shows full specs, current assignee card, and history timeline.
- Assigning an asset updates its status to "In Use", adds assignee card, and appends "Assigned" event to timeline.
- Returning an asset removes assignee card, changes status to "Available", and appends "Returned" event.
- Delete removes the asset and redirects to inventory.

---

### Week 5 — Add Asset Form & Employee Directory

**Theme:** Build the two remaining core pages.

#### Add Asset Page (`client/src/pages/AddAssetPage.jsx`)
- [x] Build `AddAssetForm.jsx` with all fields from PRD §6.7.1.
- [x] Category dropdown — loaded from `GET /api/categories`.
- [x] Location dropdown — from `OFFICE_LOCATIONS` constant.
- [x] Serial number field with **"Auto-gen"** button (Wand icon).
- [x] Build `serialGenerator.js` utility — generates `SN-[A-Z]{3}[0-9]{3}` format, checks uniqueness via `GET /api/serial/scan/:serial`.
- [x] Cost field — input as dollars (`$XX.XX`), store as cents in backend.
- [x] Purchase date field — defaults to today.
- [x] Optional "Assign to Employee" section at bottom with employee search dropdown.
- [x] On submit:
  - If no employee selected → `POST /api/assets` with `status='available'`.
  - If employee selected → `POST /api/assets` then `POST /api/assets/:id/assign`.
- [x] Success: show toast + redirect to the new asset's detail page.
- [x] Inline validation errors beneath each required field.
- [x] Submit button disabled during in-flight request.

#### Employees Page (`client/src/pages/EmployeesPage.jsx`)
- [x] Create `useEmployees()` hook — fetches `GET /api/employees`.
- [x] Build `EmployeeCard.jsx` — avatar (initials fallback), name, department, location, Google sync badge.
- [x] Employee directory renders as a responsive card grid.
- [x] Search input filters the grid by name, email, or department.
- [x] Build `EmployeeAssetDrawer.jsx` — modal showing all assets assigned to a clicked employee.
  - Fetches `GET /api/employees/:id/assets` on open.
  - Lists each asset: category badge, name, serial, assignment date.
  - Empty state if no assets assigned.
- [x] Clicking any employee card opens the drawer.

**Week 5 Exit Criteria:**
- New asset can be created with all fields; serial auto-generation works and generates unique values.
- Creating an asset with an employee pre-selected creates it as "In Use" and logs both Created and Assigned events.
- Employee directory shows all 8 seeded employees in a responsive grid.
- Clicking an employee opens the drawer showing their assigned assets.

---

### Week 6 — Phase 1 Integration, Bugfix & Handoff

**Theme:** Wire everything together, fix integration bugs, and prepare Phase 1 for demo.

#### Integration Tasks
- [x] Verify all navigation links in the sidebar route to the correct pages.
- [x] Ensure all context state (assets, employees, categories) refreshes after mutations.
- [x] Wire the "View items" shortcut from Category breakdown on the Dashboard to the Inventory page pre-filtered.
- [x] Ensure Activity Feed updates when actions are taken (re-fetch on focus or poll every 60 seconds).
- [x] Add global offline detection banner (detect `navigator.onLine` + listen to `offline` event).

#### UI Polish (Phase 1 Scope)
- [x] Ensure all pages have loading skeletons (not spinners) for initial data fetch.
- [x] Ensure all lists/tables have empty states with icon + message + CTA.
- [x] Ensure all error states show a descriptive message + Retry button.
- [x] Verify toast notifications appear for: asset created, assigned, returned, retired, deleted.
- [x] Fix any layout overflow issues on 1280px viewport.

#### Testing
- [x] Write unit tests for `assetService.js` (create, assign, return, retire, delete).
- [x] Write unit tests for `serialGenerator.js` (format, uniqueness check).
- [x] Write unit tests for `formatters.js` (currency, date).
- [x] Write integration tests for: `POST /api/assets`, `POST /api/assets/:id/assign`, `GET /api/assets/:id`.
- [x] Run all tests; fix any failures.

#### Documentation
- [x] Update `README.md` with accurate setup steps.
- [x] Seed data covers all 4 offices, all categories, and a range of statuses.

**Week 6 Exit Criteria (Phase 1 Complete):**
- [x] All P0 features from PRD §6 are functional end-to-end.
- [x] No console errors on any page in the happy path.
- [x] All unit and integration tests pass.
- [x] IT Admin persona can complete the following user journey without assistance:
  - Register a new laptop → assign it to an employee → view the audit log → return it → retire it.
- [x] Phase 1 demo completed with Engineering Lead sign-off.

---

## 4. Phase 2.0 — Migrate to Supabase

**Goal:** Change AssetTrack's database from SQLite to Supabase (managed PostgreSQL) to make it cloud-production-ready, while keeping the raw parameterized SQL architecture intact.

### Phase 2.0 Objectives & Tasks
- [ ] Create the Supabase project.
- [ ] Set up the Supabase CLI and local dev environment (Docker-based).
- [ ] Convert the SQLite schema into Supabase migrations (Postgres syntax, SERIAL/TIMESTAMPTZ).
- [ ] Convert the service layer to use `async`/`await` with the `pg` driver.
- [ ] Add the `sessions` table to the database schema.
- [ ] Fix session validation to use the DB-backed sessions table instead of the in-memory Map.
- [ ] Re-verify every Phase 1 feature against Supabase (tests and manual checks).
- [ ] Run a full cross-component sync check (defined in Prompt B).

### Exit Criteria
- Every Phase 1 feature behaves identically on Supabase.
- No `better-sqlite3` or SQLite references remain anywhere in the codebase.
- Every mutation correctly updates every view that depends on that data.

---

## 5. Phase 2 — Scanner & Google Sync

**Duration:** 4 weeks (Weeks 7–10)  
**Goal:** Add live barcode/serial scanning via webcam and full Google Workspace OAuth + Directory sync.

---

### Phase 2 Objectives

- [ ] Live webcam scanner using `@zxing/library` decoding barcode frames.
- [ ] Simulated laser viewfinder with animated scanline when camera is unavailable.
- [ ] Serial simulator dropdown for testing/demo.
- [ ] Google OAuth 2.0 configuration UI (Client ID + domain input).
- [ ] Google Directory fetch and sync with duplicate prevention.
- [ ] Google Workspace banner on Dashboard showing connection status.
- [ ] Assigned employees with `is_google_synced = 1` show verified badge on all views.

---

### Week 7 — Barcode Scanner: Webcam & ZXing

**Theme:** Build the live camera scanning experience.

#### Scanner Page Setup
- [x] Install `@zxing/library`: `npm install @zxing/library`.
- [x] Create `ScannerPage.jsx` — container for all scanner sub-components.
- [x] Build `useScanner()` custom hook:
  - Calls `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.
  - On success: attaches stream to `<video>` ref, initialises `BrowserMultiFormatReader`.
  - On error (denied / no device): sets `cameraAvailable = false`.
  - Returns: `{ videoRef, cameraAvailable, scanResult, isScanning, stopScanner }`.
  - Cleanup: stops media tracks on unmount.

#### Webcam Feed & Viewfinder
- [x] Build `WebcamFeed.jsx`:
  - Renders `<video autoPlay playsInline muted ref={videoRef}>` when camera is available.
  - Overlays the interactive reticle (corner brackets) on top of the video.
  - Renders an animated scanline div inside the reticle (`animate-scanline` keyframe).
- [x] Build `LaserViewfinder.jsx`:
  - Shown when `cameraAvailable = false`.
  - Static viewfinder box with red animated laser scanline (no video feed).
  - Shows "Camera unavailable — use serial simulator below" message.
- [x] Add "Toggle Camera" button that calls `stopScanner()` and falls back to `LaserViewfinder`.

#### ZXing Decode Loop
- [x] Inside `useScanner()`, after stream is attached:
  - `reader.decodeFromVideoElement(videoEl, (result, error) => { ... })`.
  - On `result`: extract `result.getText()` as the scanned serial string.
  - Debounce successive results (500ms) to avoid duplicate resolution calls.
  - Call `GET /api/serial/scan/:serial` with the decoded value.
- [x] Build `ScanResultCard.jsx` — displayed below the viewfinder on a successful scan:
  - Asset name, category badge, serial, status pill, office location.
  - "Go to Asset" button → navigates to `/inventory/:id`.
  - "Clear" button → resets scan result, resumes scanning.
- [x] Error state: "No asset found for this serial number" with a retry indicator.

**Week 7 Exit Criteria:**
- [x] On a laptop with a webcam, opening Scanner Page requests camera permission.
- [x] Holding a barcode up to the camera resolves the serial and shows the asset card.
- [x] Denying camera permission shows the laser viewfinder without crashing.

---

### Week 8 — Serial Simulator & Scanner UX Polish

**Theme:** Developer/demo tools + full scanner UX refinement.

#### Serial Simulator
- [x] Build `SerialSimulator.jsx`:
  - Fetches all serial numbers from `GET /api/assets?fields=serial_number,name`.
  - Renders a styled `<select>` dropdown with all serials + asset names.
  - On change: fires the same resolution flow as a real scan (`GET /api/serial/scan/:serial`).
  - Displays `ScanResultCard` on match; error state on no match.
- [x] Add "Simulate Scan" button that triggers selection, for demo/keyboard-only use.

#### Scanner Page UX Polish
- [x] Layout: camera/viewfinder on top half, simulator + result card on bottom half.
- [x] Camera permission instructions shown before first use (collapsible info card).
- [x] Scan history: show last 5 scanned serials in a compact list below the result card.
- [x] Add sound feedback toggle (optional beep on successful scan using Web Audio API).
- [x] Mobile-responsive layout: full-width viewfinder on small screens.

#### Backend: Serial Scan Endpoint
- [x] Confirm `GET /api/serial/scan/:serial` returns full asset object + assignee + history count.
- [x] Case-insensitive serial match (use `UPPER()` in SQLite query or normalise on insert).
- [x] Add rate limiting on this endpoint to prevent brute-force serial enumeration (10 req/min per IP).

**Week 8 Exit Criteria:**
- [x] Serial simulator dropdown is populated from real database serials.
- [x] Selecting a serial shows the correct asset card and "Go to Asset" navigates to the correct page.
- [x] Scanner page is usable on mobile (Chrome on Android / Safari on iOS with HTTPS).

---

### Week 9 — Google OAuth Configuration & Backend

**Theme:** Build the Google OAuth plumbing on the server side.

#### Google OAuth Backend (`server/routes/google.js` + `server/services/googleService.js`)
- [ ] Install `googleapis`: `npm install googleapis`.
- [ ] `GET /api/google/config` — return current config (client_id, domain) from `google_config` table.
- [ ] `POST /api/google/config` — validate and save client_id + domain to DB.
- [ ] `POST /api/google/auth` — exchange auth code for tokens using `google.auth.OAuth2` client.
  - Verify `id_token` with Google's public keys.
  - Extract `hd` (hosted domain) from token — reject if it does not match configured domain.
  - Store access token in-memory (Map keyed by session UUID).
  - Return session UUID to frontend.
- [ ] `GET /api/google/directory` — use stored access token to call Admin SDK:
  - `admin.users.list({ domain, maxResults: 500, orderBy: 'email' })`.
  - Compare returned emails against `employees` table.
  - Return `{ users: [...], alreadySynced: [emails] }`.
- [ ] `POST /api/google/sync` — bulk insert selected users into `employees` table.
  - Use `INSERT OR IGNORE` to handle concurrent duplicate prevention.
  - Return `{ added: N, skipped: M }`.

#### Session Middleware
- [ ] Create `middleware/validateSession.js` — reads `Authorization: Bearer <token>` header, looks up in in-memory Map, attaches admin info to `req.admin`.
- [ ] Apply `validateSession` to all `/api/*` routes except `GET /api/google/config` and the auth endpoint.

**Week 9 Exit Criteria:**
- `POST /api/google/config` saves values to DB and `GET /api/google/config` returns them.
- Auth flow works end-to-end in Postman: exchange code → receive session token.
- Calling `/api/google/directory` with a valid token returns user list with `alreadySynced` array.

---

### Week 10 — Google Workspace UI & Dashboard Integration

**Theme:** Build the Google Workspace settings UI and wire sync into the app.

#### Settings Page — Google Tab (`client/src/pages/SettingsPage.jsx`)
- [ ] Build `GoogleConfigForm.jsx`:
  - Inputs: Client ID, Organization Domain.
  - Loads existing values from `GET /api/google/config` on mount.
  - Save button → `POST /api/google/config` → success toast.
  - Expandable "Setup Instructions" accordion with step-by-step Google Cloud Console guide.
- [ ] Install `@react-oauth/google`: `npm install @react-oauth/google`.
- [ ] Wrap app root with `<GoogleOAuthProvider clientId={...}>` in `App.jsx`.
- [ ] Add "Sign in with Google" button that triggers OAuth consent flow.
  - On success: sends auth code to `POST /api/google/auth` → stores session token in `sessionStorage`.

#### Directory Sync Panel (`client/src/components/settings/DirectorySyncPanel.jsx`)
- [ ] "Fetch Directory" button → calls `GET /api/google/directory`.
- [ ] Renders checklist of all returned users:
  - Name, email, department, avatar (or initials fallback).
  - Already-synced users: greyed out, disabled checkbox, "Already Synced" label.
  - New users: enabled checkbox, selected by default.
- [ ] Real-time search input filters checklist by name, email, or department.
- [ ] "Select All" / "Deselect All" toggle buttons.
- [ ] "Sync Selected" button → `POST /api/google/sync` with selected user array → toast with `"X employees added, Y already existed"`.

#### Dashboard Integration
- [ ] Update `GoogleBanner.jsx` to show real connection status:
  - Reads `GET /api/google/config`.
  - If domain is set: "Connected — @company.com — N employees synced".
  - If not set: "Not Configured — Go to Settings".
- [ ] Employee cards in directory show Google sync badge (✓) for `is_google_synced = 1` employees.
- [ ] AssigneeCard on asset detail shows Google sync badge for synced assignees.

**Week 10 Exit Criteria:**
- [ ] Admin can enter Client ID + domain in Settings and save without error.
- [ ] "Fetch Directory" shows the list of Google Workspace users.
- [ ] Already-synced users are correctly greyed out.
- [ ] "Sync Selected" adds employees to the database; running it again for the same users shows them as "Already Synced".
- [ ] Dashboard Google Banner reflects current sync status.
- [ ] Phase 2 demo completed with Engineering Lead sign-off.

---

## 5. Phase 3 — Polish & Settings

**Duration:** 2 weeks (Weeks 11–12)  
**Goal:** Production-grade quality — category management, responsive layout, accessibility, full test coverage, and performance review.

---

### Phase 3 Objectives

- [x] Category management grid and custom category builder.
- [x] Settings page with tabbed navigation (Google + Categories).
- [x] Fully responsive layout (mobile, tablet, desktop).
- [ ] WCAG AA accessibility audit completed and issues resolved.
- [ ] Performance review — all pages meet targets from PRD §10.1.
- [ ] End-to-end test coverage for all critical flows.

---

### Week 11 — Categories, Settings Tab & Responsiveness

#### Categories Page (`client/src/pages/CategoriesPage.jsx`)
- [x] Build `CategoryCard.jsx`:
  - Shows badge (char + color), name, description.
  - Shows total assets in category + how many are in use.
  - "View items" button → navigates to `/inventory?category=<id>`.
- [x] Build `CategoryBuilder.jsx` modal form:
  - Fields: name, description, badge char (max 1), color picker (8 options).
  - Live badge preview updates as user types/selects.
  - Submit → `POST /api/categories`.
- [x] "Edit" button on existing category cards → pre-fills builder form → `PUT /api/categories/:id`.
- [x] "Delete" button → confirmation modal → `DELETE /api/categories/:id`.
  - If assets exist in the category → show `409 Conflict` error message instead of deleting.

#### Settings Page Tabs
- [x] Build `SettingsPage.jsx` with two tab options: **Google Workspace** and **Categories**.
- [x] Google tab: `GoogleConfigForm` + `DirectorySyncPanel` (from Phase 2).
- [x] Categories tab: `CategoryCard` grid + "Add Category" button opening `CategoryBuilder`.
- [x] Tab state persisted to URL: `/settings` (Google) and `/settings/categories`.

#### Responsive Layout *(Completed ahead of schedule, July 2026)*
- [x] Sidebar collapses to icon-only at tablet width (768–1024px).
- [x] Sidebar becomes a slide-in drawer (hamburger menu) on mobile (< 768px). *(Revised: Replaced with persistent bottom tab bar for primary nav and top-bar admin menu for secondary).*
- [x] Metric cards stack to 2×2 grid on tablet, 1-column on mobile.
- [x] Asset table becomes horizontally scrollable on mobile.
- [x] Employee card grid adjusts: 3 columns → 2 columns → 1 column across breakpoints.
- [x] Modals are full-screen on mobile.
- [x] Scanner viewfinder is full-width and taller on mobile.
- [ ] *Requires real-device QA*: Verify tap target sizes on physical iOS/Android screens and scanner viewport height.

**Week 11 Exit Criteria:**
- Category management: can create, edit, and delete categories. Deleting a category in use shows an error.
- Settings page tabs switch correctly and URL updates.
- App is usable on a 375px wide mobile viewport without horizontal overflow.

---

### Week 12 — Accessibility, Performance & Final QA

#### Accessibility Audit
- [x] Run Lighthouse accessibility audit on all 8 pages; fix all failures.
- [x] Verify all form inputs have associated `<label>` elements.
- [x] Verify all icon-only buttons have `aria-label`.
- [x] Verify all modals trap focus and restore focus on close.
- [x] Verify Escape key closes all modals and drawers.
- [x] Verify Tab/Shift-Tab navigation works throughout without focus traps.
- [x] Verify color is not the sole differentiator on status pills (add icon).
- [x] Verify minimum tap target size (44×44px) on all interactive elements.

#### Performance Review
- [x] Run Lighthouse performance audit; target FCP < 2 seconds.
- [x] Add `React.memo` to `AssetTableRow` and `EmployeeCard` to prevent unnecessary re-renders.
- [x] Verify inventory table renders 200 assets in < 500ms (use large seed dataset for test).
- [x] Check bundle size (`npm run build` + `vite preview`); split code if bundle > 500KB.
- [x] Verify Axios instance has a 10-second timeout and handles it gracefully.

#### End-to-End Tests (Critical Flows)
- [x] Install Playwright: `npm init playwright@latest`.
- [x] E2E test: Register new asset → verify appears in inventory.
- [x] E2E test: Assign asset to employee → verify status changes to "In Use".
- [x] E2E test: Return asset → verify status changes to "Available".
- [x] E2E test: Search by serial number → verify correct asset appears.
- [x] E2E test: Filter by category → verify only that category's assets appear.

#### Final QA Pass
- [x] Test all pages on Chrome 90+, Firefox 88+, Safari 14+.
- [x] Test all pages on a real mobile device (Android Chrome + iOS Safari).
- [x] Verify no `console.error` or `console.warn` on any page in the happy path.
- [x] Verify all toast notifications appear and auto-dismiss correctly.
- [x] Verify all empty states appear on pages with no data.

**Week 12 Exit Criteria (v1.0 Release Candidate):**
- [x] Lighthouse accessibility score ≥ 90 on all pages.
- [x] Lighthouse performance score ≥ 80 on all pages.
- [x] All E2E tests pass in CI.
- [x] All unit and integration tests pass.
- [x] Sign-off from IT Admin persona on the complete user journey.
- [x] Production deployment checklist complete (HTTPS, env vars, DB backup cron).
- [x] v1.0 tagged in Git.

---

## 6. Phase 4 — Post-Launch v1.1

**Duration:** Ongoing from Week 13  
**Goal:** Enhance the system based on real user feedback gathered in the first month of production use.  
**Trigger:** At least 2 weeks of production usage before Phase 4 items are prioritised.

---

### Completed & Candidate Features

| Priority | Feature | Description | Status |
|---|---|---|---|
| P0 | **Excel Import** | Multi-sheet `.xlsx` import with date conversion, sub-asset auto-linking, serial deduplication | ✅ Completed |
| P0 | **Excel Export** | Export full inventory across 4 sheets (*Laptops*, *Headphones*, *Keyboard Mouse*, *Client*) | ✅ Completed |
| P1 | **Office Location Management** | Dynamic DB-driven locations table and settings UI | ✅ Completed |
| P1 | **Asset QR Code Generation** | SVG QR code generator (`qrcode.react`) with printable sticker popup | ✅ Completed |
| P1 | **Extended Asset Schema** | 17 new DB columns + dynamic form rendering for Laptops, Headphones, Keyboards, Client assets | ✅ Completed |
| P1 | **Sub-Asset Accessories** | Parent-child linking (`parent_id`) for adaptors/chargers with cascading assignment/return | ✅ Completed |
| P1 | **Bulk Asset Assignment** | One-step multi-asset employee assignment modal | ✅ Completed |
| P2 | **Multi-Role RBAC** | Role-based access control (`admin`, `employee`, `hr`) with JWT session invalidation | ✅ Completed |
| P3 | **PostgreSQL Migration** | Migrated database engine from SQLite to Supabase Postgres (using `pg` driver) | ✅ Completed |
| P3 | **Warranty Tracking Countdown**| `getWarrantyDaysLeft` utility with visual countdown display on SpecsProfile | ✅ Completed |
| P1 | **Email Notifications** | Send email on asset assignment, return, or retirement using Nodemailer + SMTP | ⬜ Candidate (v2) |
| P2 | **Slack Notifications** | Post messages to a Slack webhook on lifecycle events | ⬜ Candidate (v2) |
| P2 | **Depreciation Tracker** | Calculate current asset value based on purchase date, cost, and depreciation schedule | ⬜ Candidate (v2) |
| P2 | **Software License Category** | Track software licenses as a special category type with seat counts | ⬜ Candidate (v2) |
| P3 | **Asset Photo Upload** | Attach a photo to an asset record (stored as file path or base64) | ⬜ Candidate (v2) |
| P3 | **RFID/NFC Exploration** | Research feasibility of NFC tag scanning via Web NFC API on Android | ⬜ Candidate (v2) |

### Phase 4 Process
1. Collect user feedback in the first 2 weeks post-launch (Google Form or Slack channel).
2. Engineering Lead + IT Admin triage feedback and map to the feature list above.
3. Prioritise top 3 features for a 2-week sprint.
4. Run sprint, release as `v1.1.0`.
5. Repeat quarterly.

---

## 7. Phase 5 — RBAC, Ticketing, and Onboarding

**Duration:** 2 weeks (Weeks 14-15)  
**Goal:** Expand AssetTrack from a single-actor tool (Admin only) to a multi-actor platform by introducing Role-Based Access Control (RBAC), an Employee Ticketing portal, and an HR Onboarding portal.

### Phase 5 Objectives & Status
- [x] Implemented global JWT-based authentication system with a login wall (`/login`).
- [x] Designed and integrated Role-Based Access Control (Roles: `admin`, `employee`, `hr`).
- [x] Built the Employee Ticketing Module:
  - Employees can raise hardware "request" or "issue" tickets and dynamically route them to specific admin queues (IT, Hardware, HR).
  - Admins can review, reject, transfer, or resolve tickets by assigning physical inventory assets.
  - Employees must explicitly confirm ticket resolution (setting the status to `closed`) or can choose to reopen it.
- [x] Built the HR Onboarding Module:
  - HR can submit hardware requests for incoming new hires.
  - Admins can pre-allocate ("arrange") physical assets against those requests prior to the employee joining.
- [x] Enforced cross-module synchronization (e.g., ticket resolution automatically fires `assignAsset` in the core inventory).
- [x] Updated automated E2E tests for the new authenticated environment.
- [x] Full UI/UX regression pass completed.

**Phase 5 Complete.**

---

## 8. Master Gantt Summary

```
Week │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │ 9  │ 10 │ 11 │ 12 │ 13+
─────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────
     │◄────────────── PHASE 1 (MVP Core) ──────────────►│
Setup│████│    │    │    │    │    │    │    │    │    │    │    │
APIs │    │████│    │    │    │    │    │    │    │    │    │    │
Dash │    │    │████│    │    │    │    │    │    │    │    │    │
Detail    │    │    │████│    │    │    │    │    │    │    │    │
Forms│    │    │    │    │████│    │    │    │    │    │    │    │
Int. │    │    │    │    │    │████│    │    │    │    │    │    │
─────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────
     │         │◄────────── PHASE 2 (Scanner & Google) ─────────►│
Scan │    │    │    │    │    │    │████│████│    │    │    │    │
Auth │    │    │    │    │    │    │    │    │████│████│    │    │
─────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────
     │              │◄──── PHASE 3 (Polish) ──────────────────────►│
Cat. │    │    │    │    │    │    │    │    │    │    │████│    │
QA   │    │    │    │    │    │    │    │    │    │    │    │████│
─────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────
v1.0 │    │    │    │    │    │    │    │    │    │    │    │  ★ │
v1.1+│    │    │    │    │    │    │    │    │    │    │    │    │████
```

---

## 8. Dependencies & Blockers

| Dependency | Required By | Owner | Status |
|---|---|---|---|
| Google Cloud Console project created with OAuth credentials | Phase 2, Week 9 | IT Admin | ⬜ Pending |
| Google Workspace Admin SDK enabled for the org domain | Phase 2, Week 9 | IT Admin | ⬜ Pending |
| Production server / VM provisioned (for HTTPS) | Phase 3, Week 12 | IT Admin | ⬜ Pending |
| TLS certificate obtained for production domain | Phase 3, Week 12 | IT Admin | ⬜ Pending |
| Decision on hosting: on-premise vs. cloud VM | Before Phase 2 | Engineering Lead | ⬜ Pending |
| Final list of office locations confirmed | Phase 1, Week 1 | Operations | ✅ Resolved (4 offices) |
| All developers onboarded and machines set up | Phase 1, Week 1 | Engineering Lead | ✅ Completed |
| Existing asset data (if CSV import needed at launch) | Phase 1, Week 6 | IT Admin | ⬜ Pending |

---

## 9. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Google OAuth credentials not ready before Phase 2 starts | Medium | High | Begin Google Cloud Console setup in Week 6. IT Admin owns this from Day 1. |
| 2 | Webcam scanner doesn't work on iOS Safari (HTTP) | High | Medium | Production HTTPS is mandatory. Test scanner on HTTPS from Week 7 onwards. |
| 3 | SQLite file locking under concurrent writes | Low | Medium | `better-sqlite3` is synchronous and single-process; locking is not an issue unless multiple Node processes are run. Use PM2 in single-process mode. |
| 4 | ZXing barcode decoder performance too slow on low-end laptops | Medium | Medium | Test on minimum-spec laptop early in Week 7. Have simulator as fallback for all users. |
| 5 | Scope creep from IT Admin requesting v2 features during v1 build | High | Medium | Maintain a Phase 4 backlog. Politely defer new requests to Phase 4 prioritisation. |
| 6 | Google Directory API returns > 500 employees | Low | Low | Add pagination (use `nextPageToken`) in Week 10. Set expectation with IT Admin. |
| 7 | Asset data migration from existing spreadsheets takes longer than expected | Medium | Medium | Treat CSV import as a Phase 4 feature. For v1 launch, manual entry or a one-time seed script is acceptable. |
| 8 | Team member unavailable for a sprint | Medium | High | Keep tasks modular enough that backend and frontend work are independent. Document all APIs before frontend consumption. |

---

## 10. Definition of Done

A feature is **Done** when **all** of the following are true:

### Code Quality
- [ ] Code follows all rules in `rules.md`.
- [ ] No `console.log` in production code paths.
- [ ] No commented-out code.
- [ ] No magic strings or numbers (constants used).
- [ ] No `TODO` comments without a linked GitHub issue.

### Testing
- [ ] Unit tests written and passing for all new service functions.
- [ ] Integration test written for any new API endpoint.
- [ ] No existing tests broken by the change.
- [ ] Tested manually in Chrome (happy path + at least 1 error path).

### Review
- [ ] PR created with description explaining why the change was made.
- [ ] PR references a GitHub issue number.
- [ ] At least 1 reviewer has approved the PR.
- [ ] All reviewer comments resolved.

### UI/UX (for frontend features)
- [ ] Loading state implemented.
- [ ] Empty state implemented (if the component shows a list).
- [ ] Error state implemented with Retry button.
- [ ] Works on 1280px desktop viewport without overflow.
- [ ] Tailwind classes used (no inline style props).

### Merged & Closed
- [ ] PR squash-merged into `main`.
- [ ] Feature branch deleted.
- [ ] Linked GitHub issue closed.

---

*End of Document*

**Prepared by:** ANIRUDH BHATIA 
**Review requested from:** IT Admin, Operations Coordinator, Engineering Team  
**Next step:** Confirm team availability → align Week 1 start date → kick off Phase 1.
