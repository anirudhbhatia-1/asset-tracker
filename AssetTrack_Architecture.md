# AssetTrack — Technical Architecture Document

**Document Version:** 1.0  
**Date:** July 21, 2026  
**Status:** Draft  
**Audience:** Engineering Team  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
   - 3.1 Tech Stack
   - 3.2 Project Structure
   - 3.3 Routing
   - 3.4 Component Tree
   - 3.5 State Management
   - 3.6 API Communication
4. [Backend Architecture](#4-backend-architecture)
   - 4.1 Tech Stack
   - 4.2 Project Structure
   - 4.3 Middleware Pipeline
   - 4.4 Route Modules
   - 4.5 Service Layer
5. [Database Architecture](#5-database-architecture)
   - 5.1 Engine & Rationale
   - 5.2 Schema (DDL)
   - 5.3 Entity-Relationship Diagram
   - 5.4 Indexes
   - 5.5 Migration Strategy
6. [Google Workspace Integration](#6-google-workspace-integration)
   - 6.1 OAuth 2.0 Flow
   - 6.2 Directory Sync Flow
7. [Barcode Scanner Architecture](#7-barcode-scanner-architecture)
8. [Security Architecture](#8-security-architecture)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Environment Configuration](#10-environment-configuration)
11. [Folder Structure (Monorepo)](#11-folder-structure-monorepo)

---

## 1. System Overview

AssetTrack is a **full-stack, single-page web application** built as a lightweight monorepo. It consists of:

- A **React (Vite) SPA** that handles all user interaction.
- A **Node.js / Express REST API** that serves data and coordinates business logic.
- A **SQLite database** (`assets.db`) as the single persistence layer — no external database server required.
- A **Google Workspace integration layer** for OAuth login and employee directory sync.

The system is designed to run as a **self-hosted service** within the company's internal network, or optionally deployed on a single cloud VM (GCP/AWS/Azure).

---

## 2. High-Level Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                        CLIENT (Browser)                          ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │                  React SPA (Vite)                        │    ║
║  │                                                         │    ║
║  │  ┌────────────┐  ┌───────────────┐  ┌────────────────┐ │    ║
║  │  │  UI Views  │  │ ZXing Scanner │  │ Google OAuth   │ │    ║
║  │  │ (Pages /   │  │ (Webcam API)  │  │ Client (JS SDK)│ │    ║
║  │  │ Components)│  └───────┬───────┘  └───────┬────────┘ │    ║
║  │  └─────┬──────┘          │                  │          │    ║
║  │        │       HTTP/JSON │    OAuth Token    │          │    ║
║  └────────┼─────────────────┼──────────────────┼──────────┘    ║
║           │                 │                  │               ║
╚═══════════╪═════════════════╪══════════════════╪═══════════════╝
            │  REST API calls │                  │ Google Sign-In
            ▼                 ▼                  ▼
╔═══════════════════════════════════╗   ╔═════════════════════════╗
║   Node.js / Express Backend       ║   ║  Google APIs            ║
║                                   ║   ║                         ║
║  ┌──────────────────────────────┐ ║   ║  ┌───────────────────┐  ║
║  │  Route Handlers              │ ║   ║  │ OAuth 2.0         │  ║
║  │  /api/assets                 │ ║   ║  │ Token Endpoint    │  ║
║  │  /api/employees              │◄╬───╬──│                   │  ║
║  │  /api/categories             │ ║   ║  └───────────────────┘  ║
║  │  /api/history                │ ║   ║  ┌───────────────────┐  ║
║  │  /api/google                 │◄╬───╬──│ Admin SDK         │  ║
║  │  /api/serial                 │ ║   ║  │ Directory API     │  ║
║  └──────────────┬───────────────┘ ║   ║  └───────────────────┘  ║
║                 │                 ║   ╚═════════════════════════╝
║  ┌──────────────▼───────────────┐ ║
║  │  Service Layer               │ ║
║  │  (Business Logic)            │ ║
║  └──────────────┬───────────────┘ ║
║                 │                 ║
║  ┌──────────────▼───────────────┐ ║
║  │  better-sqlite3 Driver       │ ║
║  └──────────────┬───────────────┘ ║
║                 │                 ║
╚═════════════════╪═════════════════╝
                  │
        ┌─────────▼──────────┐
        │   SQLite File DB   │
        │   (assets.db)      │
        └────────────────────┘
```

---

## 3. Frontend Architecture

### 3.1 Tech Stack

| Concern | Library / Tool | Version |
|---|---|---|
| Framework | React | 18.x |
| Build Tool | Vite | 5.x |
| Routing | React Router | 6.x |
| Styling | Tailwind CSS | 3.x |
| Icons | Lucide React | latest |
| HTTP Client | Axios | 1.x |
| Barcode Scanning | @zxing/library | 0.21.x |
| Google Auth | @react-oauth/google | latest |
| Date Formatting | date-fns | 3.x |
| Notifications | react-hot-toast | 2.x |

### 3.2 Project Structure

```
client/
├── public/
│   └── favicon.ico
├── src/
│   ├── main.jsx                  # App entry point
│   ├── App.jsx                   # Root: Router + Providers
│   ├── index.css                 # Tailwind directives + global styles
│   │
│   ├── api/                      # Axios API layer
│   │   ├── axiosInstance.js      # Base URL, interceptors
│   │   ├── assetsApi.js
│   │   ├── employeesApi.js
│   │   ├── categoriesApi.js
│   │   ├── historyApi.js
│   │   └── googleApi.js
│   │
│   ├── context/                  # Global state
│   │   ├── AppContext.jsx        # Root context provider
│   │   ├── AssetsContext.jsx     # Asset list + mutations
│   │   ├── EmployeesContext.jsx  # Employee directory state
│   │   └── GoogleContext.jsx     # OAuth session state
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAssets.js
│   │   ├── useEmployees.js
│   │   ├── useScanner.js         # Webcam + ZXing logic
│   │   ├── useSearch.js          # Debounced search
│   │   └── useGoogleAuth.js
│   │
│   ├── pages/                    # Top-level route views
│   │   ├── DashboardPage.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── AssetDetailPage.jsx
│   │   ├── ScannerPage.jsx
│   │   ├── EmployeesPage.jsx
│   │   ├── CategoriesPage.jsx
│   │   ├── AddAssetPage.jsx
│   │   └── SettingsPage.jsx
│   │
│   ├── components/               # Reusable UI components
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TopBar.jsx
│   │   │   └── PageWrapper.jsx
│   │   ├── dashboard/
│   │   │   ├── MetricCard.jsx
│   │   │   ├── InventoryBreakdown.jsx
│   │   │   ├── ActivityFeed.jsx
│   │   │   └── GoogleBanner.jsx
│   │   ├── inventory/
│   │   │   ├── SearchBar.jsx
│   │   │   ├── FilterToolbar.jsx
│   │   │   ├── AssetTable.jsx
│   │   │   └── AssetTableRow.jsx
│   │   ├── asset/
│   │   │   ├── SpecsProfile.jsx
│   │   │   ├── HistoryTimeline.jsx
│   │   │   ├── AssigneeCard.jsx
│   │   │   └── LifecycleActions.jsx
│   │   ├── scanner/
│   │   │   ├── WebcamFeed.jsx
│   │   │   ├── LaserViewfinder.jsx
│   │   │   ├── ScanResultCard.jsx
│   │   │   └── SerialSimulator.jsx
│   │   ├── employees/
│   │   │   ├── EmployeeCard.jsx
│   │   │   └── EmployeeAssetDrawer.jsx
│   │   ├── categories/
│   │   │   ├── CategoryCard.jsx
│   │   │   └── CategoryBuilder.jsx
│   │   ├── forms/
│   │   │   ├── AddAssetForm.jsx
│   │   │   ├── AssignmentModal.jsx
│   │   │   └── CategoryForm.jsx
│   │   ├── settings/
│   │   │   ├── GoogleConfigForm.jsx
│   │   │   └── DirectorySyncPanel.jsx
│   │   └── ui/                   # Atomic / primitive UI
│   │       ├── Button.jsx
│   │       ├── Badge.jsx
│   │       ├── StatusPill.jsx
│   │       ├── Modal.jsx
│   │       ├── Toast.jsx
│   │       ├── Spinner.jsx
│   │       └── EmptyState.jsx
│   │
│   └── utils/
│       ├── serialGenerator.js    # Auto-gen serial logic
│       ├── formatters.js         # Date, currency formatters
│       └── constants.js          # Locations, status enums
│
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

### 3.3 Routing

All routes are defined in `App.jsx` using React Router v6:

```
/                          → DashboardPage
/inventory                 → InventoryPage
/inventory/:id             → AssetDetailPage
/scanner                   → ScannerPage
/employees                 → EmployeesPage
/categories                → CategoriesPage
/add-asset                 → AddAssetPage
/settings                  → SettingsPage (default: Google tab)
/settings/categories       → SettingsPage (Categories tab)
*                          → 404 NotFoundPage
```

All routes are wrapped in a `<ProtectedRoute>` component that checks for an active admin session.

### 3.4 Component Tree

```
App
└── AppContext.Provider
    └── GoogleOAuthProvider
        └── BrowserRouter
            └── Layout
                ├── Sidebar
                ├── TopBar
                └── <Outlet> (route content)
                    ├── DashboardPage
                    │   ├── MetricCard (×4)
                    │   ├── InventoryBreakdown
                    │   ├── GoogleBanner
                    │   └── ActivityFeed
                    ├── InventoryPage
                    │   ├── SearchBar
                    │   ├── FilterToolbar
                    │   └── AssetTable
                    │       └── AssetTableRow (×n)
                    ├── AssetDetailPage
                    │   ├── SpecsProfile
                    │   ├── AssigneeCard
                    │   ├── LifecycleActions
                    │   │   └── AssignmentModal (conditional)
                    │   └── HistoryTimeline
                    ├── ScannerPage
                    │   ├── WebcamFeed | LaserViewfinder
                    │   ├── ScanResultCard
                    │   └── SerialSimulator
                    ├── EmployeesPage
                    │   ├── SearchBar
                    │   ├── EmployeeCard (×n)
                    │   └── EmployeeAssetDrawer (modal)
                    ├── CategoriesPage
                    │   ├── CategoryCard (×n)
                    │   └── CategoryBuilder (modal)
                    ├── AddAssetPage
                    │   └── AddAssetForm
                    └── SettingsPage
                        ├── GoogleConfigForm
                        └── DirectorySyncPanel
```

### 3.5 State Management

State is managed using React Context + hooks. No external state library (Redux/Zustand) is used in v1.

| Context | Manages |
|---|---|
| `AssetsContext` | Asset list, filters, selected asset, mutations (add, update, delete, assign) |
| `EmployeesContext` | Employee list, selected employee, sync status |
| `CategoriesContext` | Category list and mutations |
| `GoogleContext` | OAuth session (user info, token), config values |
| `UIContext` | Sidebar open/close, active modal, toast queue |

**Data flow pattern:**

```
User Action
    │
    ▼
Component calls hook (e.g., useAssets().assignAsset())
    │
    ▼
Hook calls API function (assetsApi.assign(id, payload))
    │
    ▼
Axios sends POST /api/assets/:id/assign
    │
    ▼
Backend processes, responds with updated asset
    │
    ▼
Hook updates Context state (optimistic or after response)
    │
    ▼
All subscribed components re-render with new data
```

### 3.6 API Communication

All API calls go through a centralized Axios instance (`src/api/axiosInstance.js`):

```javascript
// src/api/axiosInstance.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach auth token if present
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: global error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    toast.error(error.response?.data?.message || 'Something went wrong');
    return Promise.reject(error);
  }
);

export default api;
```

---

## 4. Backend Architecture

### 4.1 Tech Stack

| Concern | Library | Version |
|---|---|---|
| Runtime | Node.js | 20.x LTS |
| Framework | Express | 4.x |
| Database Driver | better-sqlite3 | 9.x |
| Google API Client | googleapis | 140.x |
| Input Validation | express-validator | 7.x |
| CORS | cors | 2.x |
| Env Config | dotenv | 16.x |
| Logging | morgan | 1.x |

### 4.2 Project Structure

```
server/
├── index.js                  # Entry point: Express app + server start
├── db.js                     # SQLite connection + schema init
│
├── routes/
│   ├── assets.js             # /api/assets/*
│   ├── employees.js          # /api/employees/*
│   ├── categories.js         # /api/categories/*
│   ├── history.js            # /api/history
│   ├── google.js             # /api/google/*
│   └── serial.js             # /api/serial/scan/:serial
│
├── services/
│   ├── assetService.js       # Asset CRUD + lifecycle logic
│   ├── employeeService.js    # Employee CRUD
│   ├── categoryService.js    # Category CRUD
│   ├── historyService.js     # Audit log writes + reads
│   └── googleService.js     # OAuth token exchange + Directory API calls
│
├── middleware/
│   ├── validateRequest.js    # express-validator error handler
│   └── errorHandler.js       # Global Express error handler
│
└── package.json
```

### 4.3 Middleware Pipeline

Every incoming request flows through this pipeline in `index.js`:

```
Incoming HTTP Request
        │
        ▼
┌─────────────────────┐
│  cors()             │  Allow cross-origin from Vite dev server
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  express.json()     │  Parse JSON body
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  morgan('dev')      │  Log method, path, status, response time
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  Route Handlers     │  /api/assets, /api/employees, etc.
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  404 Handler        │  Unmatched routes
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  Global Error       │  Catches all thrown errors, returns JSON
│  Handler            │  { error: true, message: "...", code: 500 }
└─────────────────────┘
```

### 4.4 Route Modules

#### `/api/assets`
```
GET    /api/assets                 → list all (query: ?status=, ?category=, ?location=, ?q=)
GET    /api/assets/:id             → get one asset with its history
POST   /api/assets                 → create asset
PUT    /api/assets/:id             → update asset fields
DELETE /api/assets/:id             → delete asset (hard delete)
POST   /api/assets/:id/assign      → assign to employee
POST   /api/assets/:id/return      → return to stock
POST   /api/assets/:id/retire      → retire asset
```

#### `/api/employees`
```
GET    /api/employees              → list all employees
GET    /api/employees/:id          → get one employee
GET    /api/employees/:id/assets   → assets assigned to employee
POST   /api/employees              → add employee manually
PUT    /api/employees/:id          → update employee
DELETE /api/employees/:id          → remove employee
```

#### `/api/categories`
```
GET    /api/categories             → list all categories
POST   /api/categories             → create category
PUT    /api/categories/:id         → update category
DELETE /api/categories/:id         → delete category (if no assets use it)
```

#### `/api/history`
```
GET    /api/history                → recent activity feed (query: ?limit=20)
GET    /api/assets/:id/history     → full history for one asset
```

#### `/api/google`
```
GET    /api/google/config          → retrieve saved OAuth config
POST   /api/google/config          → save OAuth config (client_id, domain)
GET    /api/google/directory       → fetch users from Google Workspace
POST   /api/google/sync            → bulk-import selected users to employees table
```

#### `/api/serial`
```
GET    /api/serial/scan/:serial    → resolve serial to asset record
```

### 4.5 Service Layer

Business logic lives in service files, not route handlers. Routes are thin controllers.

**Example: `assetService.js`**

```javascript
// Key functions:
createAsset(payload)          // Insert + log 'created' history event
updateAsset(id, fields)       // Update fields + log changes
assignAsset(id, employeeId, date, note)  // Set status='in-use', log 'assigned'
returnAsset(id, note)         // Set status='available', log 'returned'
retireAsset(id, note)         // Set status='retired', log 'retired'
deleteAsset(id)               // Hard delete + log 'deleted'
getAssetWithHistory(id)       // JOIN asset + history + assignee
listAssets(filters)           // Parameterized filter query
```

---

## 5. Database Architecture

### 5.1 Engine & Rationale

**SQLite** via `better-sqlite3` was chosen for v1 because:
- Zero external infrastructure — runs as a single file (`assets.db`).
- Synchronous API is simpler for a single-process Express server.
- Sufficient for up to ~50,000 rows with proper indexing.
- Easy to back up (just copy the `.db` file).
- Upgrade path to PostgreSQL is straightforward if scale demands it.

> **Upgrade trigger:** If total asset + history rows exceed 100,000, or concurrent writes cause lock contention, migrate to PostgreSQL using the same query structure (minimal changes needed).

### 5.2 Schema (DDL)

```sql
-- Categories (created first; assets reference it)
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    UNIQUE NOT NULL,
  description TEXT,
  badge_char  TEXT    CHECK(length(badge_char) <= 1),
  color       TEXT,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  email            TEXT    UNIQUE NOT NULL,
  department       TEXT,
  location         TEXT,
  google_id        TEXT,
  avatar_url       TEXT,
  is_google_synced INTEGER DEFAULT 0,
  created_at       TEXT    DEFAULT (datetime('now'))
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  model           TEXT,
  serial_number   TEXT    UNIQUE NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'available'
                          CHECK(status IN ('available','in-use','retired')),
  location        TEXT,
  cost_cents      INTEGER DEFAULT 0,
  purchase_date   TEXT,
  notes           TEXT,
  assigned_to     INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  assigned_date   TEXT,
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now'))
);

-- Audit / History Log
CREATE TABLE IF NOT EXISTS asset_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id     INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type   TEXT    NOT NULL
                       CHECK(event_type IN
                         ('created','assigned','returned','retired','deleted','updated')),
  performed_by TEXT,
  employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  note         TEXT,
  event_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Google OAuth Configuration (single-row table)
CREATE TABLE IF NOT EXISTS google_config (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id  TEXT,
  domain     TEXT,
  updated_at TEXT    DEFAULT (datetime('now'))
);
```

### 5.3 Entity-Relationship Diagram

```
┌──────────────────┐        ┌────────────────────┐
│   categories     │        │     employees       │
├──────────────────┤        ├────────────────────┤
│ id (PK)          │        │ id (PK)            │
│ name             │        │ name               │
│ description      │        │ email (UNIQUE)     │
│ badge_char       │        │ department         │
│ color            │        │ location           │
│ created_at       │        │ google_id          │
└────────┬─────────┘        │ avatar_url         │
         │ 1                │ is_google_synced   │
         │                  │ created_at         │
         │ N                └────────┬───────────┘
┌────────▼─────────────────────┐    │ 1
│           assets             │    │
├──────────────────────────────┤    │ N (assigned_to)
│ id (PK)                      │◄───┘
│ name                         │
│ category_id (FK→categories)  │
│ model                        │
│ serial_number (UNIQUE)       │
│ status                       │
│ location                     │
│ cost_cents                   │
│ purchase_date                │
│ notes                        │
│ assigned_to (FK→employees)   │
│ assigned_date                │
│ created_at                   │
│ updated_at                   │
└──────────────┬───────────────┘
               │ 1
               │
               │ N
┌──────────────▼───────────────┐
│        asset_history         │
├──────────────────────────────┤
│ id (PK)                      │
│ asset_id (FK→assets)         │
│ event_type                   │
│ performed_by                 │
│ employee_id (FK→employees)   │
│ note                         │
│ event_at                     │
└──────────────────────────────┘

┌──────────────────────────────┐
│        google_config         │  (standalone, 1 row)
├──────────────────────────────┤
│ id (PK)                      │
│ client_id                    │
│ domain                       │
│ updated_at                   │
└──────────────────────────────┘
```

### 5.4 Indexes

```sql
-- Speed up inventory list queries
CREATE INDEX IF NOT EXISTS idx_assets_status       ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category     ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_location     ON assets(location);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to  ON assets(assigned_to);

-- Speed up history lookups per asset
CREATE INDEX IF NOT EXISTS idx_history_asset_id    ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_history_event_at    ON asset_history(event_at DESC);

-- Speed up employee email lookup (for duplicate prevention)
CREATE INDEX IF NOT EXISTS idx_employees_email     ON employees(email);
```

### 5.5 Migration Strategy

Since this is v1 with a single developer/team:
- Schema is created on server startup via `db.js` using `CREATE TABLE IF NOT EXISTS`.
- For future schema changes, a simple `migrations/` folder with numbered SQL files will be applied on startup in order.
- No ORM is used — raw SQL via `better-sqlite3` for maximum control and performance.

---

## 6. Google Workspace Integration

### 6.1 OAuth 2.0 Flow

```
User clicks "Sign in with Google" in the app
        │
        ▼
@react-oauth/google triggers Google's OAuth consent screen
(redirect_uri = http://localhost:5173 in dev,
               https://assettrack.company.com in prod)
        │
        ▼
User grants consent → Google returns authorization code
        │
        ▼
Frontend sends code to backend: POST /api/google/auth
        │
        ▼
Backend exchanges code for:
  - access_token  (used for Directory API calls)
  - id_token      (contains user identity claims)
  - refresh_token (persisted server-side for background sync)
        │
        ▼
Backend verifies id_token with Google's public keys
Extracts: email, name, sub (google_id), hd (hosted domain)
        │
        ▼
Validates hd == configured domain (e.g., company.com)
        │
    ┌───┴───┐
   Yes      No
    │        │
    ▼        ▼
Allowed   Return 403 Forbidden
    │
    ▼
Backend creates a short-lived session token (JWT or UUID)
Returns session token to frontend
        │
        ▼
Frontend stores token in sessionStorage
All subsequent API calls include: Authorization: Bearer <token>
```

### 6.2 Directory Sync Flow

```
Admin navigates to Settings → Google Workspace
        │
        ▼
Frontend calls GET /api/google/directory
        │
        ▼
Backend uses stored access_token to call:
  GET https://admin.googleapis.com/admin/directory/v1/users
  ?domain=company.com&maxResults=500&orderBy=email
        │
        ▼
Google Directory API returns list of user objects:
  { id, name.fullName, primaryEmail, department, thumbnailPhotoUrl }
        │
        ▼
Backend compares emails against local employees table
Returns to frontend:
  { users: [...], alreadySynced: [emails already in DB] }
        │
        ▼
Frontend renders checklist:
  - New users: selectable checkbox
  - Already synced: greyed out, disabled, "Already Synced" label
        │
        ▼
Admin selects users → clicks "Sync Selected"
Frontend calls POST /api/google/sync with array of selected user objects
        │
        ▼
Backend inserts each user into employees table:
  { name, email, department, google_id, avatar_url, is_google_synced=1 }
Skips duplicates (ON CONFLICT DO NOTHING)
        │
        ▼
Returns summary: { added: N, skipped: M }
Frontend shows toast: "X employees synced successfully"
```

---

## 7. Barcode Scanner Architecture

### 7.1 Live Webcam Scanner

```
ScannerPage mounts
        │
        ▼
useScanner() hook called
        │
        ▼
navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment' }
})
        │
    ┌───┴───────────────┐
 Granted             Denied / Error
    │                    │
    ▼                    ▼
stream attached      Show LaserViewfinder
to <video> element   (simulated mode)
    │
    ▼
ZXing BrowserMultiFormatReader initialized
reader.decodeFromVideoElement(videoEl, callback)
        │
        ▼ (on each frame decode attempt)
ZXing returns Result or error
        │
    ┌───┴───────────────┐
 Match found         No match / checksum fail
    │                    │
    ▼                    ▼
Extract text         Continue scanning
(serial/barcode)
    │
    ▼
Call GET /api/serial/scan/:serial
        │
    ┌───┴───────────────┐
 Asset found         Not found
    │                    │
    ▼                    ▼
Render ScanResultCard   Show error state
with asset details      "No asset found"
+ "Go to Asset" button
```

### 7.2 Simulated Laser Viewfinder (CSS)

```css
/* Laser scanline animation */
@keyframes scanline {
  0%   { top: 0%; }
  100% { top: 100%; }
}

.laser-line {
  position: absolute;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.7);
  animation: scanline 2s linear infinite;
}
```

### 7.3 Serial Simulator

- A `<select>` dropdown populated by calling `GET /api/assets?fields=serial_number`.
- On change event, fires the same resolution flow as a real scan:
  `GET /api/serial/scan/:selectedSerial`
- Intended for development/testing and demo use.

---

## 8. Security Architecture

### 8.1 Authentication Model (v1)

> **v1 uses a simplified single-admin model.** Multi-user RBAC is planned for v2.

- Google OAuth is used to verify the admin's identity.
- Only users whose email domain matches the configured `domain` (e.g., `company.com`) are permitted.
- The backend issues a session UUID stored in-memory (Map), returned to the frontend.
- Frontend stores this UUID in `sessionStorage` (cleared on tab close).
- All `/api/*` routes check for a valid session token via middleware.

### 8.2 Input Validation & Sanitization

- All POST/PUT route handlers use `express-validator` rules.
- All database queries use **parameterized statements** (never string concatenation):
  ```javascript
  // ✅ Safe
  db.prepare('SELECT * FROM assets WHERE status = ?').get(status);

  // ❌ Never do this
  db.exec(`SELECT * FROM assets WHERE status = '${status}'`);
  ```

### 8.3 Secrets Management

| Secret | Storage |
|---|---|
| Google Client ID | Server `.env` file (`GOOGLE_CLIENT_ID`) — never in frontend bundle |
| Google Client Secret | Server `.env` file (`GOOGLE_CLIENT_SECRET`) |
| Session UUIDs | In-memory Map on server (not persisted to DB) |
| Google Access Token | In-memory on server (per-session, not persisted) |
| Google Refresh Token | If needed, encrypted in `google_config` table |

### 8.4 CORS Policy

```javascript
cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
})
```

### 8.5 HTTPS

- In production, the app **must** be served over HTTPS.
- Required for: `getUserMedia()` webcam access, Google OAuth (redirect URI must be HTTPS), sessionStorage security.
- Use a reverse proxy (Nginx) with a valid TLS certificate (Let's Encrypt or company cert).

---

## 9. Deployment Architecture

### 9.1 Development (Local)

```
Terminal 1: cd server && npm run dev   → Express on :3001
Terminal 2: cd client && npm run dev   → Vite HMR on :5173
```

Vite proxies `/api/*` requests to `:3001` via `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

### 9.2 Production (Self-Hosted VM / Docker)

```
┌─────────────────────────────────────────────────┐
│           Ubuntu VM / Docker Container           │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  Nginx (reverse proxy + TLS termination) │   │
│  │  port 443 (HTTPS)                        │   │
│  └───────┬──────────────────────────────────┘   │
│          │                                      │
│          ├─── /           → serve /client/dist  │
│          └─── /api/*      → proxy :3001         │
│                                                 │
│  ┌──────────────────────┐                       │
│  │  Node.js Express     │  (pm2 process manager)│
│  │  port 3001           │                       │
│  └──────────┬───────────┘                       │
│             │                                   │
│  ┌──────────▼───────────┐                       │
│  │  assets.db (SQLite)  │                       │
│  │  /data/assets.db     │                       │
│  └──────────────────────┘                       │
└─────────────────────────────────────────────────┘
```

### 9.3 Docker Compose (Optional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data        # persist SQLite file
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/assets.db
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - CLIENT_ORIGIN=https://assettrack.company.com

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./client/dist:/usr/share/nginx/html
      - ./certs:/etc/ssl/certs
    depends_on:
      - app
```

### 9.4 Database Backup

```bash
# Daily cron (runs at 2am)
0 2 * * * cp /data/assets.db /backups/assets_$(date +%Y%m%d).db

# Keep last 30 days
find /backups -name "assets_*.db" -mtime +30 -delete
```

---

## 10. Environment Configuration

### `server/.env`

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_PATH=./assets.db

# Google OAuth
GOOGLE_CLIENT_ID=1234567890-abcde.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:5173

# Security
CLIENT_ORIGIN=http://localhost:5173
SESSION_SECRET=change-me-in-production
```

### `client/.env`

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=1234567890-abcde.apps.googleusercontent.com
```

---

## 11. Folder Structure (Monorepo)

```
assettrack/
├── client/                   # React Vite frontend
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── utils/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                   # Node.js Express backend
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── db.js
│   ├── index.js
│   └── package.json
│
├── data/                     # SQLite DB file (gitignored)
│   └── assets.db
│
├── backups/                  # DB backup storage (gitignored)
│
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
├── .env.example
├── .gitignore
└── README.md
```

### `.gitignore`

```
node_modules/
data/assets.db
backups/
client/dist/
server/.env
client/.env
*.log
```

---

*End of Document*

**Prepared by:** Engineering Team  
**Review requested from:** Lead Developer, IT Administrator  
**Next step:** Approve architecture → begin Phase 1 scaffold.
