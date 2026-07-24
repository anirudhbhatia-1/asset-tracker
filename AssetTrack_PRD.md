# AssetTrack — Product Requirements Document (PRD)

**Document Version:** 1.0  
**Date:** July 21, 2026  
**Status:** Draft — Awaiting Review  
**Owner:** IT Operations / Product Team  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [Scope & Out of Scope](#5-scope--out-of-scope)
6. [Feature Requirements](#6-feature-requirements)
   - 6.1 Dashboard & Metrics
   - 6.2 Inventory Management
   - 6.3 Asset Detail & Lifecycle
   - 6.4 Barcode / Serial Scanner
   - 6.5 Employee Directory & Assignment
   - 6.6 Category Management
   - 6.7 Add New Asset
   - 6.8 Google Workspace Integration
   - 6.9 Settings & Configuration
7. [Technical Architecture](#7-technical-architecture)
8. [Data Models](#8-data-models)
9. [UI/UX Requirements](#9-uiux-requirements)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Release Roadmap](#11-release-roadmap)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

**AssetTrack** is a web-based, full-stack asset management system designed for IT administrators and operations teams to track, assign, audit, and retire physical hardware assets — including laptops, monitors, mice, keyboards, headsets, and corporate swag — across multiple Indian offices (Bangalore, Mumbai, Delhi, Hyderabad).

The system provides a single source of truth for hardware lifecycle management, integrates directly with Google Workspace for employee identity, and enables instant physical-to-digital resolution via live webcam barcode/serial scanning — eliminating manual spreadsheets and fragmented ownership records.

---

## 2. Problem Statement

| Pain Point | Current Impact |
|---|---|
| Assets tracked in disparate spreadsheets per office | No unified view; duplication, shadow inventory |
| No formal lifecycle records | Assets disappear; no audit trail for loss or damage |
| Manual employee-to-asset mapping | Error-prone; outdated on employee churn |
| No physical-to-digital resolution | Admins can't quickly identify an asset just by looking at its sticker |
| No multi-location awareness | Impossible to know how many spare laptops Hyderabad has without calling someone |

---

## 3. Goals & Success Metrics

### Primary Goals
- Provide a **single, real-time inventory ledger** across all offices.
- Enable **sub-30-second asset identification** via barcode/serial scan.
- Maintain a **tamper-proof audit log** for every asset lifecycle event.
- Eliminate manual employee lookup by syncing directly from **Google Workspace Directory**.

### Key Performance Indicators (KPIs)

| Metric | Target |
|---|---|
| Time to identify asset by serial number | < 30 seconds |
| Asset data completeness | > 95% assets have all required fields |
| Sync latency from Google Directory | < 5 seconds |
| Audit log coverage | 100% of state transitions logged |
| Admin onboarding time | < 1 day to full proficiency |

---

## 4. User Personas

### Persona 1 — IT Administrator (Primary)
- **Name:** Rajan Sharma
- **Role:** IT Manager, Bangalore HQ
- **Goals:** Register new assets, assign hardware on joining, track returns, retire old stock, audit before quarterly reviews.
- **Pain Points:** Currently uses 3 separate Google Sheets; can't see Mumbai's inventory without calling.
- **Tech Comfort:** High — comfortable with admin dashboards and OAuth setups.

### Persona 2 — Operations Coordinator (Secondary)
- **Name:** Priya Nair
- **Role:** Office Operations, Mumbai
- **Goals:** See what's available locally, hand out swag during onboarding, log returns.
- **Pain Points:** Has to ping the IT team to check availability; no self-service visibility.
- **Tech Comfort:** Medium — comfortable with web UIs, not with backend configuration.

### Persona 3 — Finance Auditor (Tertiary / Read-Only)
- **Name:** Sneha Kulkarni
- **Role:** Finance, Hyderabad
- **Goals:** Verify asset costs, depreciation inputs, confirm asset ownership records quarterly.
- **Pain Points:** Receives outdated export files. Needs real-time data access without editing rights.
- **Tech Comfort:** Medium.

---

## 5. Scope & Out of Scope

### In Scope (v1.0)
- Full inventory CRUD (Create, Read, Update, Delete) for all asset types.
- Multi-office location tagging (Bangalore, Mumbai, Delhi, Hyderabad).
- Asset status lifecycle: **Available → In Use → Retired**.
- Barcode/serial scanner via browser webcam (live + simulated).
- Google Workspace OAuth 2.0 login and Directory sync.
- Employee-to-asset assignment with custom date picker.
- Complete audit/history log per asset.
- Category management with visual themes.
- Dashboard with metrics, inventory breakdown, and activity feed.
- Settings for OAuth configuration and category creation.
- Supabase Postgres database (server-side, via Node.js backend).

### Out of Scope (v1.0 — Considered for v2+)
- Mobile native app (iOS/Android).
- Automated depreciation calculations / financial reporting.
- Integration with procurement/ERP systems (e.g., SAP, Zoho).
- RFID/NFC hardware integration.
- Role-based access control (RBAC) with multiple admin tiers.
- Email/Slack notification system on asset events.
- Export to CSV/PDF reports.
- Software license tracking.

---

## 6. Feature Requirements

---

### 6.1 Dashboard & Metrics

**Priority:** P0 (Must Have)

#### 6.1.1 At-a-Glance Metrics Grid
The dashboard landing page **must** display four summary metric cards in a responsive grid:

| Card | Metric |
|---|---|
| Total Assets | Count of all records in inventory |
| In Use | Count of assets with status = `in-use` |
| Available | Count of assets with status = `available` |
| Retired | Count of assets with status = `retired` |

- Cards must update in real-time on any data mutation without full page reload.
- Each card should display a percentage change indicator (week-over-week) where calculable.

#### 6.1.2 Inventory Breakdown by Type
- A visual section showing percentage distribution bars across all configured asset categories.
- Each category bar must show: icon, label, count, and fill percentage relative to total assets.
- Must dynamically respond to new categories being added via Settings.

#### 6.1.3 Google Workspace Integration Banner
- A prominent feature card on the dashboard highlighting active Google Workspace integration status.
- Displays: connection status (Connected / Not Configured), configured domain (e.g., `@company.com`), and number of synced employees.
- Includes a shortcut link to the Google Settings configuration page.

#### 6.1.4 Live Activity Feed
- A chronological, reverse-ordered stream of recent system actions displayed on the dashboard.
- Each feed item must include:
  - Action type tag with distinct color coding:
    - `assignment` — Blue
    - `google` — Green (Google Workspace events)
    - `status` — Yellow/Amber
    - `category` — Purple
    - `retire` — Red
  - Human-readable description of the action.
  - Relative timestamp (e.g., "2 hours ago").
- Feed must show the most recent 20 events and support lazy-load or pagination for older entries.

---

### 6.2 Inventory Management

**Priority:** P0 (Must Have)

#### 6.2.1 Universal Search Bar
- A persistent top-of-page search input.
- Must perform **real-time, client-side filtering** (or debounced server search) across:
  - Asset name
  - Serial number
  - Model
  - Office location
  - Assigned employee name
- Search results must update within 300ms of keystroke.
- Empty state must show a friendly illustration and "No assets found" message.

#### 6.2.2 Multi-Facet Filter Toolbar
- **Category Filter Chips:** Horizontal scrollable row of chips for each configured category: `All Types`, `Laptop`, `Mouse`, `Keyboard`, `Monitor`, `Audio/Headset`, `T-Shirt/Merch`, plus any custom categories.
- **Status Dropdown:** Dropdown selector with options: `All Statuses`, `In Use`, `Available`, `Retired`.
- **Location Filter (recommended for v1.1):** Dropdown for office location.
- Active filters must be visually highlighted (filled chip vs. outline chip).
- Filters must be combinable (AND logic across different facets).

#### 6.2.3 Interactive Data Table
Each row in the inventory table must display:

| Column | Content |
|---|---|
| Category | Color-coded badge icon with 1-char shortcode (e.g., `L` for Laptop) |
| Asset Name | Full name, clickable to Asset Detail view |
| Serial Number | Monospace font display |
| Status | Live status pill: In Use (blue), Available (green), Retired (grey) |
| Location | Office city |
| Assigned To | Employee name (or "—" if unassigned) |
| Assignment Date | Formatted date or "—" |
| Actions | Quick-action button (View Detail) |

- Table must support client-side sorting by clicking column headers.
- Rows must have hover highlight state.
- Table must be horizontally scrollable on smaller viewports.

---

### 6.3 Asset Detail & Lifecycle

**Priority:** P0 (Must Have)

#### 6.3.1 Hardware Specifications Profile
A dedicated asset detail page/view accessible by clicking an asset in the inventory. Must display:
- Asset Name, Category Badge
- Model / Make
- Serial Number (with copy-to-clipboard button)
- Cost (USD, formatted as `$X,XXX.00`)
- Purchase Date
- Office Location
- Administrative Notes (free text, editable inline)
- Current Status pill

#### 6.3.2 Complete Assignment & Audit History Log
- A visual, chronological timeline rendered beneath the spec profile.
- Each timeline event must capture:

| Field | Description |
|---|---|
| Event Type | `Created`, `Assigned`, `Returned`, `Retired` |
| Timestamp | Exact date and time (ISO 8601) |
| Performed By | Admin who triggered the action |
| Assignee | Employee name/email (for Assigned/Returned events) |
| Notes | Optional freeform comment |

- Timeline must be sorted newest-first.
- Event type must have distinct icon and color.
- Must support infinite scroll or "Load More" for assets with long histories.

#### 6.3.3 Assignee Card & Lifecycle Controller
- If asset status is `in-use`, displays a card showing:
  - Employee full name
  - Email address
  - Department
  - Google Synced badge (verified from Google Workspace)
  - Assignment date
- **Action Buttons** (contextual based on current status):

| Button | Visible When | Action |
|---|---|---|
| Assign / Reassign | Available or In Use | Opens Assignment Modal |
| Return to Stock | In Use | Sets status to Available, logs Returned event |
| Retire Asset | Available or In Use | Sets status to Retired, logs Retired event |
| Delete Asset | Any status | Permanently removes record (with confirmation dialog) |

- All destructive actions (Retire, Delete) must require a confirmation modal.

---

### 6.4 Barcode / Serial Scanner

**Priority:** P1 (High — core differentiator)**

#### 6.4.1 Live Webcam Scanner
- Access device camera using:
  ```javascript
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  ```
- Stream live video feed to an in-page `<video>` element.
- Overlay an interactive reticle / viewfinder frame on the video.
- Integrate a barcode decoding library (e.g., `@zxing/library` or `quagga2`) to process frames in real-time.
- On successful decode, extract the serial/barcode string and resolve against the asset database.

#### 6.4.2 Simulated Laser Viewfinder
- When hardware camera is **not active** (permission denied, no camera, or user toggled off):
  - Display a stylized static viewfinder box with an **animated laser scanline** (`animate-scanline` CSS keyframe animation).
  - This serves as a visual placeholder / developer/demo mode indicator.
  - The scanline must animate top-to-bottom continuously.

#### 6.4.3 Serial Number Simulator & Match Resolver
- A developer/testing tool presented as a dropdown populated with all existing serial numbers in the database (e.g., `C02XL0ABJGH5`, `LG-2231-MX`).
- On selection, instantly simulates a "scan result" and:
  - Displays the matched asset card (name, model, serial, status).
  - Provides a **"Go to Asset"** button that navigates directly to that asset's detail page.
- If no match found, displays a "No asset found for this serial number" error state.

---

### 6.5 Employee Directory & Assignment

**Priority:** P0 (Must Have)**

#### 6.5.1 Employee Directory Grid
- A grid of employee cards, each displaying:
  - Avatar (initials-based fallback if no photo)
  - Full name
  - Department
  - Office location
  - Google Workspace verified icon (✓ badge) if synced from directory
- Grid must support search by name, email, or department.

#### 6.5.2 Interactive Employee Asset Drawer
- Clicking any employee card opens a **modal/drawer** showing:
  - Employee's full profile header.
  - A complete list of all assets currently assigned to that employee.
  - Each item shows: Asset name, category badge, serial number, assignment date.
  - If no assets assigned, shows a friendly empty state.

#### 6.5.3 Hardware Assignment Form
- A modal form accessible from asset cards, asset detail pages, and the inventory table actions.
- Features:
  - Employee selector: searchable checklist of all employees (name + email + department).
  - Custom assignment date picker (allows backdating for historical records).
  - Optional assignment note field.
- On submit:
  - Asset status transitions to `in-use`.
  - Assignee is recorded.
  - An `Assigned` event is appended to the asset's audit history.
- If the asset was previously assigned, the form must be labeled "Reassign" and auto-populate the previous assignee.
- Submitting reassignment must log a `Returned` event for the previous assignee and an `Assigned` event for the new one.

---

### 6.6 Category Management

**Priority:** P1 (High)**

#### 6.6.1 Category Management Grid
- Displays all configured categories in a grid of cards.
- Each card shows:
  - 1-character badge with selected accent color.
  - Category name and description.
  - Count of total assets in this category.
  - Count of assets currently in use in this category.
  - **"View items"** button that navigates to Inventory view pre-filtered by this category.

#### 6.6.2 Custom Category Builder
- A form (accessible via "+ Add Category" button) allowing admins to:
  - Enter category name (required).
  - Enter description (optional).
  - Select 1-character badge shortcode (free input, max 1 character).
  - Select accent color theme from 8 curated palettes:

| Color Name | Hex Approx |
|---|---|
| Blue | `#3B82F6` |
| Indigo | `#6366F1` |
| Purple | `#8B5CF6` |
| Teal | `#14B8A6` |
| Cyan | `#06B6D4` |
| Emerald | `#10B981` |
| Amber | `#F59E0B` |
| Rose | `#F43F5E` |

- Live preview of badge appearance as user types/selects.
- On submit, category is immediately available in inventory filters, add asset form, and category grid.

---

### 6.7 Add New Asset

**Priority:** P0 (Must Have)**

#### 6.7.1 New Asset Registration Form
Fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| Asset Name | Text | Yes | e.g., "MacBook Pro 14-inch" |
| Category | Dropdown | Yes | From configured categories |
| Model / Specs | Text | No | Full model descriptor |
| Office Location | Dropdown | Yes | Bangalore, Mumbai, Delhi, Hyderabad |
| Cost (USD) | Number | No | Stored in cents to avoid float precision issues |
| Purchase Date | Date Picker | No | Defaults to today |
| Notes | Textarea | No | Admin freeform notes |
| Serial Number | Text | Yes | Must be unique across all assets |
| Auto-Generate Serial | Button | — | One-click generation of a unique SN |

#### 6.7.2 Auto-Generate Serial Number
- Clicking the **"Auto-gen" (Wand icon)** button generates a unique serial string matching the pattern `SN-[A-Z]{3}[0-9]{3}` (e.g., `SN-ABX472`).
- Must verify uniqueness against existing database records before populating.
- Field becomes auto-populated but remains editable.

#### 6.7.3 Immediate Allocation (Optional at Registration)
- An optional "Assign to Employee" section at the bottom of the form.
- If an employee is selected:
  - Asset is created with status `in-use`.
  - Assignment date defaults to today (editable).
  - An `Assigned` event is created simultaneously with the `Created` event in audit history.
- If no employee is selected, asset is created with status `available`.

---

### 6.8 Google Workspace Integration

**Priority:** P1 (High — core differentiator)**

#### 6.8.1 OAuth 2.0 Configuration
- Settings page section for Google Workspace configuration.
- Admin inputs:
  - **Google Client ID** (from Google Cloud Console) — format: `XXXXXXXXXX-abcde.apps.googleusercontent.com`
  - **Organization Domain** — format: `company.com`
- Configuration is persisted to the `google_config` table in Supabase Postgres via the backend.
- Page includes **step-by-step setup instructions** for creating OAuth credentials in Google Cloud Console (can be an expandable accordion or a linked guide).

#### 6.8.2 Directory Search & Sync Checklist
- Once configured, an admin can trigger a **"Sync Directory"** action.
- Displays a checklist of all users returned from the Google Workspace Admin SDK Directory API for the configured domain.
- Each user entry shows: Full name, email, department, profile photo (if available).
- **Already Synced** users are visually greyed out with a disabled checkbox and "Already Synced" label.
- Includes **Select All / Deselect All** toggle buttons.
- Includes a real-time search/filter input to find specific users by name, email, or department.
- On "Sync Selected" confirmation, selected employees are imported into the local `employees` table.

#### 6.8.3 Duplicate Prevention
- Before syncing, the system compares incoming Google user emails against emails already in the local database.
- Duplicate emails are automatically detected and their checkboxes are disabled (cannot be re-synced).
- The sync response shows a summary: `X users added, Y users already existed`.

---

### 6.9 Settings & Configuration

**Priority:** P1 (High)**

Consolidates all administrative configuration under one Settings view with at minimum two tabs/sections:

1. **Google Workspace** — OAuth config + Directory sync (see §6.8).
2. **Categories** — Category management grid + custom builder (see §6.6).

Additional future settings tabs (v1.1+):
- Office Locations management.
- Admin user management.
- Audit log export.

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React (Vite) | Fast HMR, component-based, wide ecosystem |
| Styling | Tailwind CSS | Utility-first, consistent design tokens |
| Routing | React Router v6 | Declarative SPA routing |
| State Management | React Context + `useState`/`useReducer` | Sufficient for v1; upgrade to Zustand for v2 |
| Backend | Node.js + Express | Lightweight REST API server |
| Database | Supabase Postgres (via `pg`) | Cloud-production-ready managed database with generous free tier |
| Barcode Scanning | `@zxing/library` or `quagga2` | Open-source, browser-native barcode decoding |
| Google Auth | Google OAuth 2.0 + Admin SDK | Official Google identity and directory access |
| Deployment | Docker container (optional) | Portable; can run on any office server or cloud VM |

### 7.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Client                      │
│                                                             │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  React UI │  │ Webcam/ZXing │  │ Google OAuth 2.0     │ │
│  │  (Vite)   │  │ Scanner      │  │ Client Library       │ │
│  └─────┬─────┘  └──────┬───────┘  └──────────┬───────────┘ │
│        │               │                      │             │
└────────┼───────────────┼──────────────────────┼─────────────┘
         │    REST API   │                      │ OAuth Token
         ▼               ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js / Express Backend                 │
│                                                             │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │ /api/assets  │  │ /api/employees  │  │ /api/google   │  │
│  │ /api/history │  │ /api/categories │  │ (OAuth + Dir) │  │
│  └──────┬───────┘  └────────┬────────┘  └───────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                             │                               │
│                     ┌───────▼──────┐                        │
│                     │ Supabase DB  │                        │
│                     │ (assets.db)  │                        │
│                     └──────────────┘                        │
└──────────────────────────────────────┬──────────────────────┘
                                       │
                             ┌─────────▼──────────┐
                             │ Google Workspace    │
                             │ Admin SDK Directory │
                             │ API                 │
                             └────────────────────┘
```

### 7.3 API Endpoints (REST)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/assets` | List all assets (supports query filters) |
| `GET` | `/api/assets/:id` | Get single asset with history |
| `POST` | `/api/assets` | Create new asset |
| `PUT` | `/api/assets/:id` | Update asset fields |
| `DELETE` | `/api/assets/:id` | Delete asset |
| `POST` | `/api/assets/:id/assign` | Assign asset to employee |
| `POST` | `/api/assets/:id/return` | Return asset to stock |
| `POST` | `/api/assets/:id/retire` | Retire asset |
| `GET` | `/api/employees` | List all employees |
| `POST` | `/api/employees` | Add employee manually |
| `GET` | `/api/employees/:id/assets` | Get all assets for an employee |
| `GET` | `/api/categories` | List all categories |
| `POST` | `/api/categories` | Create category |
| `PUT` | `/api/categories/:id` | Update category |
| `DELETE` | `/api/categories/:id` | Delete category |
| `GET` | `/api/history` | Get recent activity feed |
| `GET` | `/api/assets/:id/history` | Get history for a specific asset |
| `GET` | `/api/google/config` | Get Google config |
| `POST` | `/api/google/config` | Save Google OAuth config |
| `GET` | `/api/google/directory` | Fetch users from Google Directory |
| `POST` | `/api/google/sync` | Sync selected users to local DB |
| `GET` | `/api/serial/scan/:serial` | Resolve serial number to asset |

---

## 8. Data Models

### 8.1 `assets` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Unique asset ID |
| `name` | TEXT | NOT NULL | Display name |
| `category_id` | INTEGER | FK → categories | Category reference |
| `model` | TEXT | | Hardware model/spec string |
| `serial_number` | TEXT | UNIQUE, NOT NULL | Physical sticker serial |
| `status` | TEXT | CHECK IN ('available','in-use','retired') | Current lifecycle state |
| `location` | TEXT | | Office city |
| `cost_cents` | INTEGER | | Cost in USD cents |
| `purchase_date` | TEXT | | ISO 8601 date string |
| `notes` | TEXT | | Admin notes |
| `assigned_to` | INTEGER | FK → employees, NULLABLE | Current assignee |
| `assigned_date` | TEXT | NULLABLE | Date of current assignment |
| `created_at` | TEXT | | Record creation timestamp |
| `updated_at` | TEXT | | Last modification timestamp |

### 8.2 `employees` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Unique employee ID |
| `name` | TEXT | NOT NULL | Full name |
| `email` | TEXT | UNIQUE, NOT NULL | Corporate email |
| `department` | TEXT | | Department/team |
| `location` | TEXT | | Office city |
| `google_id` | TEXT | NULLABLE | Google Workspace user ID |
| `avatar_url` | TEXT | NULLABLE | Profile photo URL |
| `is_google_synced` | INTEGER | DEFAULT 0 | 1 if synced from Google |
| `created_at` | TEXT | | Record creation timestamp |

### 8.3 `categories` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Unique category ID |
| `name` | TEXT | UNIQUE, NOT NULL | Category label |
| `description` | TEXT | | Short description |
| `badge_char` | TEXT | MAX 1 char | Single character badge code |
| `color` | TEXT | | Accent color name or hex |
| `created_at` | TEXT | | Creation timestamp |

### 8.4 `asset_history` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Unique history record ID |
| `asset_id` | INTEGER | FK → assets, NOT NULL | Related asset |
| `event_type` | TEXT | CHECK IN ('created','assigned','returned','retired','deleted') | Event kind |
| `performed_by` | TEXT | | Admin name or email |
| `employee_id` | INTEGER | FK → employees, NULLABLE | Involved employee |
| `note` | TEXT | NULLABLE | Optional event note |
| `event_at` | TEXT | NOT NULL | Exact event timestamp |

### 8.5 `google_config` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Config row ID |
| `client_id` | TEXT | | Google OAuth Client ID |
| `domain` | TEXT | | Organization domain |
| `updated_at` | TEXT | | Last config update |

---

## 9. UI/UX Requirements

### 9.1 Design System

| Token | Value |
|---|---|
| Primary font | Inter (Google Fonts) |
| Base theme | Dark mode (default) with optional light mode toggle |
| Primary accent | Indigo (`#6366F1`) |
| Success color | Emerald (`#10B981`) |
| Warning color | Amber (`#F59E0B`) |
| Danger color | Rose (`#F43F5E`) |
| Background | `#0F172A` (slate-900) |
| Surface | `#1E293B` (slate-800) |
| Border | `#334155` (slate-700) |
| Border radius | `0.75rem` (cards), `0.5rem` (inputs), `9999px` (pills) |

### 9.2 Navigation Structure

```
Sidebar (collapsible on mobile)
├── Dashboard          (overview metrics, activity)
├── Inventory          (search, filter, table)
├── Scanner            (webcam + simulator)
├── Employees          (directory grid)
├── Categories         (category management)
├── Add Asset          (registration form)
└── Settings
    ├── Google Workspace
    └── Categories
```

### 9.3 Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 768px | Stacked; sidebar becomes bottom nav |
| Tablet | 768–1024px | Collapsed sidebar icon-only |
| Desktop | > 1024px | Full sidebar with labels |

### 9.4 Accessibility Requirements
- All interactive elements must have ARIA labels.
- Color should not be the sole differentiator (add icons/text).
- Keyboard navigable throughout (Tab/Enter/Escape).
- Minimum contrast ratio: 4.5:1 (WCAG AA).
- Modals must trap focus and dismiss on Escape key.

### 9.5 Key Animations & Interactions
- Scanner laser scanline: continuous top-to-bottom CSS keyframe animation.
- Status pill: subtle pulse on `in-use` status.
- Modal open/close: fade + scale transition (200ms).
- Card hover: subtle lift (`translateY(-2px)`) with shadow increase.
- Activity feed: slide-in from bottom on new item append.
- Filter chips: fill/outline toggle with 150ms transition.
- Metric cards: count-up animation on initial page load.

---

## 10. Non-Functional Requirements

### 10.1 Performance
- Initial page load (FCP): < 2 seconds on a standard office network.
- Inventory table render (up to 500 assets): < 500ms.
- Search debounce: 300ms.
- API response time (P95): < 200ms for read operations on Supabase Postgres.

### 10.2 Security
- Google OAuth tokens must not be persisted in localStorage; use sessionStorage or in-memory.
- All API endpoints must validate input and sanitize against SQL injection (use parameterized queries).
- Client ID must be stored server-side; never exposed in frontend bundle.
- CORS policy must restrict to the application's own origin.
- Admin actions (delete, retire) must include confirmation dialogs to prevent accidental data loss.

### 10.3 Reliability
- Database is automatically backed up via Supabase managed services.
- Graceful error handling: all API failures must display user-friendly error toasts.
- Offline state detection: if the backend is unreachable, display a banner.

### 10.4 Maintainability
- All API routes documented with JSDoc or OpenAPI spec.
- Frontend components must be modular (one component per file).
- Environment variables for all configurable values (port, DB path, etc.).

### 10.5 Browser Support
- Chrome 90+ (primary — required for webcam barcode scanning)
- Firefox 88+
- Safari 14+ (note: `getUserMedia` on iOS Safari requires HTTPS)
- Edge 90+

---

## 11. Release Roadmap

### Phase 1 — MVP (Target: ~6 weeks)
> Core inventory, CRUD, assignment, history log, dashboard.

- [ ] Project scaffold (Vite + Express + Supabase Postgres)
- [ ] Database schema and seed data
- [ ] Dashboard with metrics and activity feed
- [ ] Inventory list with search and filters
- [ ] Asset detail page with history timeline
- [ ] Add asset form with auto-serial generation
- [ ] Assignment modal with employee picker
- [ ] Employee directory grid with asset drawer

### Phase 2 — Scanner & Google Sync (~4 weeks after Phase 1)
> Barcode scanning, Google Workspace integration.

- [ ] Webcam scanner with ZXing integration
- [ ] Simulated laser viewfinder + serial simulator
- [ ] Google OAuth 2.0 configuration UI
- [ ] Google Directory fetch & sync with duplicate prevention
- [ ] Google Workspace banner on dashboard

### Phase 3 — Polish & Settings (~2 weeks after Phase 2)
> Category management, settings, UX polish.

- [ ] Category management grid and custom builder
- [ ] Settings view with tabbed navigation
- [ ] Responsive mobile layout
- [ ] Accessibility audit (WCAG AA)
- [ ] Performance profiling and optimization
- [ ] End-to-end testing of critical flows

### Phase 4 — Post-Launch Enhancements (v1.1+)
> Based on user feedback.

- [ ] CSV/PDF export for audit and finance
- [ ] Email notifications on asset events
- [ ] Multi-admin support with RBAC
- [ ] Office location management
- [ ] Software license tracking category
- [ ] RFID/NFC integration exploration

---

## 12. Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| 1 | Will the application be hosted on-premise (internal server) or on a cloud provider (GCP/AWS)? This affects OAuth redirect URI configuration. | IT Lead | High |
| 2 | Should the system support multiple concurrent admin sessions, or is single-admin sufficient for v1? | Product | High |
| 3 | What is the expected maximum asset count? (< 500? < 5,000? > 10,000?) (Resolved: Migrated to Supabase Postgres to handle scale). | IT Lead | High |
| 4 | Should Finance (read-only persona) have a separate login/role, or is full admin access acceptable for v1? | Leadership | Medium |
| 5 | Are all four offices (Bangalore, Mumbai, Delhi, Hyderabad) in scope at launch, or phased by office? | Ops | Medium |
| 6 | Is USD the only cost currency, or do we need INR support as well? | Finance | Medium |
| 7 | Who is the system owner/domain admin for Google Cloud Console OAuth credential creation? | IT Lead | High |
| 8 | Should deleted assets be hard-deleted or soft-deleted (archived) to preserve audit history? | Product | Medium |
| 9 | Is there a need to bulk-import existing assets from a spreadsheet (CSV import) at launch? | IT Lead | Medium |
| 10 | Should the activity feed be persisted server-side (in the DB) or computed on the fly from the history table? | Engineering | Low |

---

*End of Document*

**Prepared by:** Product / IT Operations Team  
**Review requested from:** Engineering Lead, IT Manager, Operations Coordinator, Finance  
**Next step:** Review open questions (§12), align on Phase 1 scope, and schedule kick-off.
