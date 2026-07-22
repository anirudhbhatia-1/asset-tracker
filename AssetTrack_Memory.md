# AssetTrack — AI Memory & Project Context

> **READ THIS FIRST.**  
> This file is the single source of truth for any AI assistant working on AssetTrack.  
> Read it completely at the start of every session before writing a single line of code.  
> Update it whenever a meaningful decision is made or the project state changes.

**Last Updated:** July 21, 2026  
**Project Status:** Pre-build — Planning & Documentation Complete  
**Current Phase:** Phase 1 not yet started  

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [What This App Does (In Plain English)](#2-what-this-app-does-in-plain-english)
3. [Tech Stack — Exact Versions](#3-tech-stack--exact-versions)
4. [Architectural Decisions & Rationale](#4-architectural-decisions--rationale)
5. [Project File Structure](#5-project-file-structure)
6. [Database Schema — Quick Reference](#6-database-schema--quick-reference)
7. [API Endpoints — Full Map](#7-api-endpoints--full-map)
8. [Code Patterns — Canonical Examples](#8-code-patterns--canonical-examples)
9. [Design Tokens & UI Rules](#9-design-tokens--ui-rules)
10. [Naming Conventions — Cheat Sheet](#10-naming-conventions--cheat-sheet)
11. [Key Business Rules](#11-key-business-rules)
12. [What NEVER to Do](#12-what-never-to-do)
13. [Current Project State](#13-current-project-state)
14. [Open Decisions (Unresolved)](#14-open-decisions-unresolved)
15. [Session Log](#15-session-log)

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Product Name** | AssetTrack |
| **Type** | Internal web application (self-hosted) |
| **Company** | [Company Name] |
| **Primary User** | IT Administrator |
| **Secondary Users** | Operations Coordinator, Finance Auditor (read-only) |
| **Offices Supported** | Bangalore, Mumbai, Delhi, Hyderabad |
| **Asset Types Tracked** | Laptops, Monitors, Mice, Keyboards, Headsets, Corporate Swag (T-shirts, bags) |
| **Auth Method** | Google Workspace OAuth 2.0 (company.com domain only) |
| **Database** | SQLite (`assets.db`) |
| **Monorepo Root** | `/assettrack/` |
| **Frontend Root** | `/assettrack/client/` |
| **Backend Root** | `/assettrack/server/` |
| **Documentation** | All 4 planning docs saved to Desktop + artifact store |

---

## 2. What This App Does (In Plain English)

AssetTrack is a web dashboard for IT admins to:

1. **Register** physical hardware (laptops, monitors, mice, bags, etc.) with a serial number, category, cost, and office location.
2. **Assign** hardware to a specific company employee (pulled from Google Workspace).
3. **Track** every asset's lifecycle: Available → In Use → Retired.
4. **Scan** a barcode/serial sticker on a physical device using a laptop or phone camera and instantly see the digital record.
5. **Audit** every event — who assigned what to whom, when, and why — with a tamper-proof history log.
6. **Sync** employees directly from the company's Google Workspace directory so there's no manual data entry for staff.

**It is NOT:**
- A financial/ERP system (no invoicing, no payroll integration).
- A software license manager (hardware only in v1).
- A public-facing app (internal use only, company domain restricted).
- A mobile native app (responsive web only).

---

## 3. Tech Stack — Exact Versions

### Frontend (`client/`)
| Package | Version | Purpose |
|---|---|---|
| `react` | 18.x | UI framework |
| `vite` | 5.x | Build tool + dev server |
| `react-router-dom` | 6.x | SPA routing |
| `tailwindcss` | 3.x | Utility-first styling |
| `lucide-react` | latest | Icons |
| `axios` | 1.x | HTTP client |
| `@zxing/library` | 0.21.x | Barcode decoding from video frames |
| `@react-oauth/google` | latest | Google OAuth 2.0 client |
| `date-fns` | 3.x | Date formatting utilities |
| `react-hot-toast` | 2.x | Toast notifications |

### Backend (`server/`)
| Package | Version | Purpose |
|---|---|---|
| `node` | 20.x LTS | Runtime |
| `express` | 4.x | HTTP framework |
| `better-sqlite3` | 9.x | SQLite driver (synchronous API) |
| `googleapis` | 140.x | Google Admin SDK + OAuth |
| `express-validator` | 7.x | Request input validation |
| `cors` | 2.x | Cross-origin resource sharing |
| `dotenv` | 16.x | Environment variable loading |
| `morgan` | 1.x | HTTP request logger |

### Dev Tools
| Tool | Purpose |
|---|---|
| `nodemon` | Backend auto-restart on file change |
| `vitest` | Unit + integration testing |
| `supertest` | HTTP integration testing for Express |
| `playwright` | E2E browser testing (Phase 3) |

---

## 4. Architectural Decisions & Rationale

Every decision here was deliberate. Do not change these without documenting a new decision.

---

### Decision 1: SQLite over PostgreSQL
**Chosen:** SQLite via `better-sqlite3`  
**Rationale:**
- Zero infrastructure — runs as a single file; no separate DB server to manage.
- Synchronous API simplifies Express route logic.
- Sufficient for up to ~100,000 rows across all tables.
- Easy to back up (copy one file).
- Upgrade path to PostgreSQL is straightforward when needed.

**Upgrade trigger:** > 100K rows combined OR concurrent write contention.  
**Do not switch to PostgreSQL prematurely.**

---

### Decision 2: React Context over Redux/Zustand
**Chosen:** React Context + `useState`/`useReducer` + custom hooks  
**Rationale:**
- App complexity does not justify a third-party state manager in v1.
- Context + hooks keeps the code readable for the team.
- Clean separation: hooks for data fetching, context for sharing state, components for rendering.

**Upgrade trigger:** Context re-renders become a measurable performance problem (use React DevTools Profiler to confirm first).

---

### Decision 3: Monorepo (client + server in one repo)
**Chosen:** Single Git repo with `client/` and `server/` directories  
**Rationale:**
- Single team, single codebase — simpler PR reviews and deploys.
- Easier to share constants (e.g., `ASSET_STATUS` values) if needed.
- No need for a separate package manager workspace setup.

---

### Decision 4: No ORM — Raw SQL with better-sqlite3
**Chosen:** Parameterized raw SQL  
**Rationale:**
- Full control over queries and indexes.
- No hidden N+1 query problems from an ORM.
- Team can read and understand every query directly.
- `better-sqlite3` is synchronous — no `await` needed, cleaner code.

**Rule:** All queries must use `?` placeholders. No string interpolation. Ever.

---

### Decision 5: Hard Delete for Assets, Soft Delete for Employees
**Chosen:** Mixed strategy  
**Rationale:**
- Assets: hard delete is fine because we log a `deleted` event in `asset_history` before deleting. The audit trail is preserved.
- Employees: soft delete (`deleted_at` column) because historical assignment records reference `employee_id`. Deleting an employee would break the FK relationship and lose audit context.
- History records: **immutable** — never deleted under any circumstances.

---

### Decision 6: Session Tokens in-Memory (Map), Not in DB
**Chosen:** In-memory `Map` on the Node.js process  
**Rationale:**
- Simplicity: no DB round-trip to validate every request.
- Session token is a UUID returned after OAuth exchange.
- Sessions expire after 8 hours inactivity.
- Acceptable for v1 (single-process, single-admin use case).

**Limitation:** Sessions are lost on server restart. Acceptable for v1.  
**Upgrade path for v2:** Store sessions in a `sessions` table or use Redis.

---

### Decision 7: Cost Stored in Cents (Integer), Not Dollars (Float)
**Chosen:** `cost_cents INTEGER` column  
**Rationale:**
- Floating-point arithmetic is unreliable for currency.
- `$1,299.99` stored as `129999` cents, displayed as `$1,299.99`.
- Avoids rounding errors in calculations.

**Frontend rule:** Always divide by 100 for display. Always multiply by 100 before sending to API.

---

### Decision 8: Vite Proxy for Local Dev (No CORS issues)
**Chosen:** Vite dev server proxies `/api/*` to Express on `:3001`  
**Rationale:**
- No CORS configuration needed during development.
- Frontend calls `/api/assets`, Vite transparently forwards to `http://localhost:3001/api/assets`.
- In production, Nginx handles the same proxying.

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

---

### Decision 9: `facingMode: 'environment'` for Webcam
**Chosen:** Rear-facing camera preferred  
**Rationale:**
- On mobile devices, the rear camera is higher quality and better suited for scanning barcodes on physical stickers.
- On laptops (which have only a front camera), the browser falls back to the available camera.
- This is the correct default for a physical asset scanning use case.

---

### Decision 10: Google Admin SDK — Not just Google Sign-In
**Chosen:** Google Admin SDK Directory API for employee sync  
**Rationale:**
- Regular Google Sign-In only provides the logged-in user's own profile.
- The Admin SDK allows fetching the entire company directory (`admin.users.list`).
- Requires the IT Admin to have a Google Workspace Super Admin account.
- The Admin SDK access token is stored in-memory on the server — never in the frontend.

---

## 5. Project File Structure

```
assettrack/                        ← Monorepo root
├── client/                        ← React Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axiosInstance.js   ← Base URL + interceptors (ALL API calls go here)
│   │   │   ├── assetsApi.js
│   │   │   ├── employeesApi.js
│   │   │   ├── categoriesApi.js
│   │   │   ├── historyApi.js
│   │   │   └── googleApi.js
│   │   ├── context/
│   │   │   ├── AppContext.jsx     ← Root provider (wraps all others)
│   │   │   ├── AssetsContext.jsx
│   │   │   ├── EmployeesContext.jsx
│   │   │   └── GoogleContext.jsx
│   │   ├── hooks/
│   │   │   ├── useAssets.js
│   │   │   ├── useEmployees.js
│   │   │   ├── useScanner.js      ← Webcam + ZXing logic
│   │   │   ├── useSearch.js       ← Debounced search
│   │   │   └── useGoogleAuth.js
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── InventoryPage.jsx
│   │   │   ├── AssetDetailPage.jsx
│   │   │   ├── ScannerPage.jsx
│   │   │   ├── EmployeesPage.jsx
│   │   │   ├── CategoriesPage.jsx
│   │   │   ├── AddAssetPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── components/
│   │   │   ├── layout/            ← Sidebar, TopBar, PageWrapper
│   │   │   ├── dashboard/         ← MetricCard, ActivityFeed, GoogleBanner, InventoryBreakdown
│   │   │   ├── inventory/         ← SearchBar, FilterToolbar, AssetTable, AssetTableRow
│   │   │   ├── asset/             ← SpecsProfile, HistoryTimeline, AssigneeCard, LifecycleActions
│   │   │   ├── scanner/           ← WebcamFeed, LaserViewfinder, ScanResultCard, SerialSimulator
│   │   │   ├── employees/         ← EmployeeCard, EmployeeAssetDrawer
│   │   │   ├── categories/        ← CategoryCard, CategoryBuilder
│   │   │   ├── forms/             ← AddAssetForm, AssignmentModal, CategoryForm
│   │   │   ├── settings/          ← GoogleConfigForm, DirectorySyncPanel
│   │   │   └── ui/                ← Button, Badge, StatusPill, Modal, Toast, Spinner, EmptyState
│   │   ├── utils/
│   │   │   ├── constants.js       ← ASSET_STATUS, OFFICE_LOCATIONS, HISTORY_EVENT_TYPES
│   │   │   ├── formatters.js      ← formatCurrency(cents), formatDate(iso)
│   │   │   └── serialGenerator.js ← generateSerial(), checkUnique(serial)
│   │   ├── App.jsx                ← Router + providers
│   │   ├── main.jsx               ← Entry point
│   │   └── index.css              ← Tailwind directives + global styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/
│   ├── routes/
│   │   ├── assets.js
│   │   ├── employees.js
│   │   ├── categories.js
│   │   ├── history.js
│   │   ├── google.js
│   │   └── serial.js
│   ├── services/
│   │   ├── assetService.js        ← All asset business logic
│   │   ├── employeeService.js
│   │   ├── categoryService.js
│   │   ├── historyService.js
│   │   └── googleService.js
│   ├── middleware/
│   │   ├── validateRequest.js     ← express-validator error handler
│   │   ├── validateSession.js     ← Session token auth guard
│   │   └── errorHandler.js        ← Global error handler
│   ├── migrations/                ← Numbered SQL migration files
│   │   └── 001_initial_schema.sql
│   ├── db.js                      ← SQLite connection + schema init
│   ├── index.js                   ← Express app + server start
│   └── package.json
│
├── data/
│   └── assets.db                  ← SQLite database (gitignored)
├── backups/                       ← Daily DB backups (gitignored)
├── .env.example
├── .gitignore
└── README.md
```

---

## 6. Database Schema — Quick Reference

### `assets`
```sql
id              INTEGER PK AUTOINCREMENT
name            TEXT NOT NULL
category_id     INTEGER FK→categories (ON DELETE SET NULL)
model           TEXT
serial_number   TEXT UNIQUE NOT NULL
status          TEXT CHECK IN ('available','in-use','retired') DEFAULT 'available'
location        TEXT                          -- one of OFFICE_LOCATIONS
cost_cents      INTEGER DEFAULT 0             -- dollars × 100
purchase_date   TEXT                          -- ISO 8601 'YYYY-MM-DD'
notes           TEXT
assigned_to     INTEGER FK→employees (NULLABLE, ON DELETE SET NULL)
assigned_date   TEXT (NULLABLE)
created_at      TEXT DEFAULT datetime('now')
updated_at      TEXT DEFAULT datetime('now')
```

### `employees`
```sql
id               INTEGER PK AUTOINCREMENT
name             TEXT NOT NULL
email            TEXT UNIQUE NOT NULL          -- corporate email
department       TEXT
location         TEXT
google_id        TEXT (NULLABLE)
avatar_url       TEXT (NULLABLE)
is_google_synced INTEGER DEFAULT 0             -- 1 = synced from Google Workspace
deleted_at       TEXT (NULLABLE)               -- soft delete
created_at       TEXT DEFAULT datetime('now')
```

### `categories`
```sql
id          INTEGER PK AUTOINCREMENT
name        TEXT UNIQUE NOT NULL
description TEXT
badge_char  TEXT (max 1 char)
color       TEXT                               -- one of 8 named palette colors
created_at  TEXT DEFAULT datetime('now')
```

### `asset_history`
```sql
id           INTEGER PK AUTOINCREMENT
asset_id     INTEGER NOT NULL FK→assets (ON DELETE CASCADE)
event_type   TEXT CHECK IN ('created','assigned','returned','retired','deleted','updated')
performed_by TEXT                              -- admin name or email
employee_id  INTEGER FK→employees (NULLABLE, ON DELETE SET NULL)
note         TEXT (NULLABLE)
event_at     TEXT NOT NULL DEFAULT datetime('now')
```
> ⚠️ **IMMUTABLE** — Never DELETE from this table.

### `google_config`
```sql
id         INTEGER PK AUTOINCREMENT
client_id  TEXT
domain     TEXT                               -- e.g. 'company.com'
updated_at TEXT DEFAULT datetime('now')
```
> Single-row table. Always UPDATE row 1; never INSERT a new row.

### Key Indexes
```sql
idx_assets_status, idx_assets_category, idx_assets_location, idx_assets_assigned_to
idx_history_asset_id, idx_history_event_at (DESC)
idx_employees_email
```

---

## 7. API Endpoints — Full Map

### Assets
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/assets` | List (supports `?status=`, `?category_id=`, `?location=`, `?q=`) |
| `GET` | `/api/assets/:id` | Single asset with history + assignee |
| `POST` | `/api/assets` | Create (logs `created` history event) |
| `PUT` | `/api/assets/:id` | Update fields (logs `updated` event) |
| `DELETE` | `/api/assets/:id` | Hard delete (logs `deleted` event first) |
| `POST` | `/api/assets/:id/assign` | Assign to employee → status `in-use` |
| `POST` | `/api/assets/:id/return` | Return to stock → status `available` |
| `POST` | `/api/assets/:id/retire` | Retire → status `retired` |

### Employees
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/employees` | List all (excludes soft-deleted) |
| `GET` | `/api/employees/:id` | Single employee |
| `GET` | `/api/employees/:id/assets` | All assets currently assigned to employee |
| `POST` | `/api/employees` | Manual create |
| `PUT` | `/api/employees/:id` | Update |
| `DELETE` | `/api/employees/:id` | Soft delete (sets `deleted_at`) |

### Categories
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/categories` | List all |
| `POST` | `/api/categories` | Create |
| `PUT` | `/api/categories/:id` | Update |
| `DELETE` | `/api/categories/:id` | Delete (409 if assets reference it) |

### History & Activity
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/history` | Recent feed (`?limit=20` default) |
| `GET` | `/api/assets/:id/history` | Full history for one asset |

### Google Workspace
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/google/config` | Get saved config (no auth required) |
| `POST` | `/api/google/config` | Save client_id + domain |
| `POST` | `/api/google/auth` | Exchange OAuth code for session token |
| `GET` | `/api/google/directory` | Fetch users from Google Workspace |
| `POST` | `/api/google/sync` | Bulk-import selected users |

### Serial Scan
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/serial/scan/:serial` | Resolve serial to asset (case-insensitive) |

### Standard Response Shape
```json
// Success (single)
{ "data": { ...resource }, "message": "OK" }

// Success (list)
{ "data": [ ...resources ], "total": 42, "message": "OK" }

// Error
{ "error": true, "message": "Asset not found", "code": 404 }
```

---

## 8. Code Patterns — Canonical Examples

### Pattern 1: Custom Hook (Data Fetching)
```javascript
// src/hooks/useAssets.js
import { useContext, useCallback } from 'react';
import { AssetsContext } from '../context/AssetsContext';
import { assignAssetApi } from '../api/assetsApi';
import toast from 'react-hot-toast';

const useAssets = () => {
  const { assets, setAssets, isLoading, error } = useContext(AssetsContext);

  const assignAsset = useCallback(async (assetId, employeeId, assignedDate, note) => {
    try {
      const updated = await assignAssetApi(assetId, { employeeId, assignedDate, note });
      setAssets(prev => prev.map(a => a.id === assetId ? updated.data : a));
      toast.success('Asset assigned successfully');
      return updated.data;
    } catch (err) {
      toast.error(err.message || 'Failed to assign asset');
      throw err;
    }
  }, [setAssets]);

  return { assets, isLoading, error, assignAsset };
};

export default useAssets;
```

### Pattern 2: API Function
```javascript
// src/api/assetsApi.js
import api from './axiosInstance';

export const getAssets = (filters = {}) =>
  api.get('/assets', { params: filters });

export const getAsset = (id) =>
  api.get(`/assets/${id}`);

export const createAsset = (payload) =>
  api.post('/assets', payload);

export const assignAssetApi = (id, payload) =>
  api.post(`/assets/${id}/assign`, payload);

export const returnAssetApi = (id, note) =>
  api.post(`/assets/${id}/return`, { note });

export const retireAssetApi = (id, note) =>
  api.post(`/assets/${id}/retire`, { note, confirm: true });

export const deleteAssetApi = (id) =>
  api.delete(`/assets/${id}`, { data: { confirm: true } });
```

### Pattern 3: Route Handler (Backend)
```javascript
// server/routes/assets.js
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');

router.post('/:id/assign', [
  param('id').isInt({ min: 1 }),
  body('employeeId').isInt({ min: 1 }),
  body('assignedDate').isISO8601(),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = assetService.assignAsset(
      Number(req.params.id),
      req.body.employeeId,
      req.body.assignedDate,
      req.body.note ?? null,
    );
    res.status(200).json({ data: result, message: 'Asset assigned successfully' });
  } catch (err) {
    next(err);
  }
});
```

### Pattern 4: Service Function with Transaction (Backend)
```javascript
// server/services/assetService.js
const db = require('../db');

const assignAsset = (assetId, employeeId, assignedDate, note) => {
  const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(assetId);
  if (!asset) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }

  const doAssign = db.transaction(() => {
    db.prepare(`
      UPDATE assets
      SET status = 'in-use', assigned_to = ?, assigned_date = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(employeeId, assignedDate, assetId);

    db.prepare(`
      INSERT INTO asset_history (asset_id, event_type, employee_id, note, event_at)
      VALUES (?, 'assigned', ?, ?, datetime('now'))
    `).run(assetId, employeeId, note);
  });

  doAssign();
  return getAssetWithHistory(assetId);
};
```

### Pattern 5: React Component Structure
```jsx
// src/components/asset/AssigneeCard.jsx
import { BadgeCheck } from 'lucide-react';
import { ASSET_STATUS } from '../../utils/constants';

const AssigneeCard = ({ employee, assignedDate }) => {
  if (!employee) return null;

  const formattedDate = formatDate(assignedDate);

  return (
    <div className="flex items-start gap-4 rounded-xl bg-slate-800 p-4 border border-slate-700">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
        {employee.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{employee.name}</span>
          {employee.isGoogleSynced && (
            <BadgeCheck className="h-4 w-4 text-emerald-400" aria-label="Google Workspace verified" />
          )}
        </div>
        <p className="text-sm text-slate-400">{employee.email}</p>
        <p className="text-xs text-slate-500 mt-1">Assigned {formattedDate}</p>
      </div>
    </div>
  );
};

export default AssigneeCard;
```

### Pattern 6: Serial Number Generator
```javascript
// src/utils/serialGenerator.js
import { scanSerial } from '../api/assetsApi';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

const randomChar = (set) => set[Math.floor(Math.random() * set.length)];

const generateCandidate = () => {
  const letters = Array.from({ length: 3 }, () => randomChar(CHARS)).join('');
  const numbers = Array.from({ length: 3 }, () => randomChar(DIGITS)).join('');
  return `SN-${letters}${numbers}`;
};

export const generateSerial = async () => {
  let candidate;
  let attempts = 0;
  do {
    candidate = generateCandidate();
    const result = await scanSerial(candidate).catch(() => null);
    if (!result?.data) return candidate;   // unique — use it
    attempts++;
  } while (attempts < 10);
  throw new Error('Could not generate a unique serial after 10 attempts');
};
```

### Pattern 7: Cost Formatting
```javascript
// src/utils/formatters.js
export const formatCurrency = (cents) => {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

export const formatDate = (iso) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(iso));
};

export const dollarsToCents = (dollars) => Math.round(parseFloat(dollars) * 100);
export const centsToDollars = (cents) => (cents / 100).toFixed(2);
```

---

## 9. Design Tokens & UI Rules

### Color Palette (Tailwind Class Names)
| Token | Tailwind Class | Hex | Use |
|---|---|---|---|
| Background | `bg-slate-900` | `#0F172A` | Page background |
| Surface | `bg-slate-800` | `#1E293B` | Cards, panels |
| Border | `border-slate-700` | `#334155` | All borders |
| Primary accent | `bg-indigo-600` | `#4F46E5` | Buttons, active states |
| Success | `text-emerald-400` | `#34D399` | Available status, success toasts |
| Warning | `text-amber-400` | `#FBBF24` | Warning states |
| Danger | `text-rose-400` | `#FB7185` | Retired, destructive actions |
| Muted text | `text-slate-400` | `#94A3B8` | Secondary labels |
| Body text | `text-slate-200` | `#E2E8F0` | Primary readable text |
| White | `text-white` | `#FFFFFF` | Headings, emphasis |

### Status Pills
| Status | Background | Text |
|---|---|---|
| `in-use` | `bg-blue-500/20` | `text-blue-400` |
| `available` | `bg-emerald-500/20` | `text-emerald-400` |
| `retired` | `bg-slate-500/20` | `text-slate-400` |

### Activity Feed Tag Colors
| Event Type | Color |
|---|---|
| `assignment` | Blue |
| `google` | Green |
| `status` | Amber |
| `category` | Purple |
| `retire` | Rose |

### Category Color Options (8 palettes)
`Blue`, `Indigo`, `Purple`, `Teal`, `Cyan`, `Emerald`, `Amber`, `Rose`

### Typography
- **Font:** Inter (from Google Fonts, loaded in `index.html`)
- **Headings:** `font-semibold` or `font-bold`, `text-white`
- **Body:** `text-slate-200`, `text-sm` or `text-base`
- **Captions/Labels:** `text-slate-400`, `text-xs`
- **Code/Serial Numbers:** `font-mono`, `text-slate-300`

### Border Radius
- Cards/Panels: `rounded-xl` (0.75rem)
- Inputs/Buttons: `rounded-lg` (0.5rem)
- Pills/Badges: `rounded-full`

### Animations
- Modal open/close: `transition-all duration-200` + scale from 95% to 100%
- Card hover: `hover:-translate-y-0.5 hover:shadow-lg transition-all duration-150`
- Status pill pulse (in-use): `animate-pulse` on the dot indicator
- Laser scanline: `animate-scanline` (custom keyframe, top → bottom, 2s linear infinite)
- Count-up on metric cards: custom `useCountUp` hook on mount

---

## 10. Naming Conventions — Cheat Sheet

| Entity | Convention | Example |
|---|---|---|
| React component file | PascalCase | `AssetDetailPage.jsx` |
| React component name | PascalCase | `AssetDetailPage` |
| Hook file | `use` + camelCase | `useAssets.js` |
| Hook function | `use` + camelCase | `useAssets()` |
| Context file | PascalCase | `AssetsContext.jsx` |
| API file | camelCase + `Api` suffix | `assetsApi.js` |
| Utility file | camelCase | `formatters.js` |
| Variable | camelCase | `currentAsset` |
| Boolean variable | `is`/`has`/`can` prefix | `isLoading`, `hasError`, `canRetire` |
| Event handler | `handle` prefix | `handleAssignClick` |
| Constants | SCREAMING_SNAKE_CASE | `ASSET_STATUS.IN_USE` |
| Backend route file | camelCase | `assets.js` |
| Backend service file | camelCase + `Service` | `assetService.js` |
| DB column | snake_case | `cost_cents`, `assigned_to` |
| API endpoint path | kebab-case | `/api/asset-history` |
| Git branch | `feat/`, `fix/`, `docs/` prefix | `feat/barcode-scanner` |
| Commit message | Conventional Commits | `feat(scanner): add ZXing decode loop` |

---

## 11. Key Business Rules

These are domain rules that must be preserved in code, regardless of implementation:

1. **A `retired` asset can never be re-assigned.** Once retired, the only allowed actions are viewing history or deleting.

2. **Every asset state transition logs a history event.** No exceptions. Created, Assigned, Returned, Retired, Deleted, Updated — all go into `asset_history`.

3. **`asset_history` is append-only and immutable.** No UPDATE or DELETE on this table, ever.

4. **Serial numbers are globally unique.** No two assets can share a serial number. The DB enforces this via `UNIQUE` constraint; the frontend must also check before submitting.

5. **Costs are stored in cents.** `cost_cents = 129999` means $1,299.99. The frontend converts on display and on input.

6. **Employees are soft-deleted.** Setting `deleted_at` removes them from the directory UI but preserves their FK relationship in historical assignment records.

7. **Only `@company.com` domain users can log in.** The backend validates the `hd` (hosted domain) claim in the Google ID token and rejects anything that doesn't match the configured domain.

8. **Google Admin SDK is server-side only.** The access token for the Directory API is stored in the Node.js process memory. It is never sent to the frontend.

9. **Destructive API calls require `confirm: true`.** Retire and Delete endpoints check for this field in the request body. The UI shows a confirmation dialog before calling them.

10. **Categories in use cannot be deleted.** If any asset references a category, `DELETE /api/categories/:id` returns `409 Conflict`.

---

## 12. What NEVER to Do

These are absolute prohibitions. If you find yourself about to do any of these, stop and reconsider.

### Database
- ❌ Never build SQL with string interpolation: `` `WHERE name = '${name}'` ``
- ❌ Never `DELETE FROM asset_history` for any reason
- ❌ Never `DROP TABLE` in any non-migration context
- ❌ Never `SELECT *` in service functions — select named columns
- ❌ Never run multiple writes without `db.transaction()`

### Security
- ❌ Never commit `.env` files to Git
- ❌ Never log `GOOGLE_CLIENT_SECRET` or any token
- ❌ Never expose the Google access token or session token in API responses
- ❌ Never set `origin: '*'` in CORS config
- ❌ Never write OAuth token exchange or session middleware with AI assistance — human-authored only

### Frontend
- ❌ Never use raw `fetch()` — use `axiosInstance.js`
- ❌ Never call API functions directly in JSX or event handlers — use hooks
- ❌ Never store computed/derived values in `useState` — use `useMemo`
- ❌ Never use class components
- ❌ Never use inline `style={{}}` props when a Tailwind class exists
- ❌ Never leave a list/table without a loading state, empty state, and error state
- ❌ Never use `window.location.href` for navigation — use `useNavigate()`

### Architecture
- ❌ Never put business logic in route handler files — it belongs in service files
- ❌ Never let a service function call `res` or `req` — services are HTTP-agnostic
- ❌ Never change the database engine (SQLite → Postgres) without documenting the decision in this file

### AI Usage
- ❌ Never paste real employee data, real serial numbers, or real `.env` values into an AI prompt
- ❌ Never let AI autonomously commit or merge code
- ❌ Never apply AI-generated security-critical code (auth, CORS, session) without human authorship

---

## 13. Current Project State

> Update this section every session.

### Status as of July 22, 2026
- **Phase:** Phase 1 — MVP Core (Weeks 1, 2, 3, & 4 completed, ready for Week 5).
- **Code written:**
  - ✅ Root monorepo structure (`/client`, `/server`, `/data`, `/backups`) initialized and tracked on branch `feat/phase-1-setup`.
  - ✅ Backend (`/server`): Node/Express initialized with `better-sqlite3`, `cors`, `morgan`, `dotenv`, `express-validator`.
  - ✅ SQLite Schema & Seeder (`server/db.js`): All 5 tables (`categories`, `employees`, `assets`, `asset_history`, `google_config`) and indexes created, with initial seed data (4 categories, 8 employees, sample assets with timeline events).
  - ✅ Express App & Core Middleware (`server/index.js`, `errorHandler.js`, `validateRequest.js`): Global error handler, 404 handler, health check (`GET /api/health`), and request validation rules.
  - ✅ Backend Core APIs & Service Layer (`server/services/*` & `server/routes/*`):
    - `categoryService` & `/api/categories`: Full CRUD with conflict check (prevents deletion if referenced by assets).
    - `employeeService` & `/api/employees`: Full CRUD with soft deletion (`deleted_at`), assigned asset counts, and `/api/employees/:id/assets` listing.
    - `historyService` & `/api/history`: Immutable append-only audit log, recent activity feed (`/api/history?limit=`), and asset timeline (`/api/assets/:id/history`).
    - `assetService` & `/api/assets` & `/api/serial/scan/:serial`: Full CRUD with transactional lifecycle actions (`assign`, `return`, `retire`), strict `confirm: true` validation on destructive routes, prohibition of re-assigning retired assets, and serial number lookup.
  - ✅ Frontend Core & UI Layout (`/client`): React 18 (Vite), Tailwind v4 (`@tailwindcss/vite`), `react-router-dom`, `axios`, `lucide-react`, `date-fns`, `react-hot-toast`. Design tokens and navigation (`Sidebar.jsx`, `TopBar.jsx`, `MainLayout.jsx`) matching dark-mode specifications.
  - ✅ Frontend API Client & Hooks (`client/src/api/*` & `client/src/hooks/*`):
    - Canonical Axios API wrappers (`assetsApi`, `categoriesApi`, `historyApi`, `employeesApi`) adhering strictly to Pattern 2.
    - Custom reactive hooks (`useMetrics`, `useAssets`, `useCategories`, `useHistory`, `useAsset`) managing loading, error, atomic lifecycle transitions, and refresh states cleanly outside components.
  - ✅ UI Primitives (`client/src/components/ui/*`):
    - `StatusPill.jsx` (`available`, `in-use` with pulsing active dot, `retired` with icon + text per Rules §8.7).
    - `Badge.jsx` (1-char category circular accent icon).
    - `Button.jsx` (`primary`, `secondary`, `danger`, `ghost` variants with inline spinner states) & `Modal.jsx` (portal with backdrop blur, Escape closing, and focus lock per Design §4).
    - `EmptyState.jsx` & `Spinner.jsx` & `Skeleton.jsx` (skeleton layout shimmer cards and table blocks per Rules §8.1).
  - ✅ Dashboard & Inventory Pages (`client/src/pages/Dashboard.jsx`, `Inventory.jsx`, and sub-components):
    - `MetricCard.jsx`, `InventoryBreakdown.jsx`, `ActivityFeed.jsx`, `GoogleBanner.jsx`, `SearchBar.jsx` (debounced with URL `?q=` sync), `FilterToolbar.jsx`, `AssetTable.jsx`, `AssetTableRow.jsx`.
  - ✅ Asset Detail Page & Lifecycle Actions (`client/src/pages/AssetDetail.jsx` & `client/src/components/asset-detail/*` & `client/src/components/forms/AssignmentModal.jsx`):
    - `SpecsProfile.jsx`: Displays full technical specs (`costCents` formatted as currency), one-click serial copy to clipboard with toast, and inline notes editor.
    - `HistoryTimeline.jsx`: Chronological vertical timeline of all `asset_history` events (`created`, `assigned`, `returned`, `retired`, `deleted`) with icons, relative timestamps (`date-fns`), and actor notes.
    - `AssigneeCard.jsx`: Displays active assigned employee profile (`name`, `email`, `department`, avatar/initials, and assigned date) when asset is `in-use`.
    - `AssignmentModal.jsx`: Searchable employee selector, assignment date picker, and optional notes field. Supports both initial assignment and reassign flows.
    - `LifecycleActions.jsx`: Contextual buttons based on current status (`Assign`, `Reassign`, `Return to Stock`, `Retire Asset`, `Delete Asset`). Enforces Rule 1 (`retired` assets cannot be modified/assigned) and two-step confirmation on permanent deletion.
- **Planning docs completed:**
  - ✅ `AssetTrack_PRD.md` — Product Requirements Document
  - ✅ `AssetTrack_Architecture.md` — Technical Architecture
  - ✅ `AssetTrack_Rules.md` — Engineering Rules & Standards (includes AI Boundaries §12)
  - ✅ `AssetTrack_Phases.md` — Project Phases & Delivery Plan
  - ✅ `AssetTrack_Memory.md` — This file
- **Next action:** Await user review of Week 4 Asset Detail Page & Lifecycle Actions → proceed to Week 5 — Add Asset Form (`AddAssetForm.jsx`, `serialGenerator.js` with auto-gen wand) & Employee Directory (`EmployeesPage.jsx`, `EmployeeTable.jsx`, `AddEmployeeModal.jsx`).

### Phase Completion Tracker
| Phase | Status | Completion |
|---|---|---|
| Phase 1 — MVP Core | 🟡 In Progress (Weeks 1, 2, 3, & 4 Done) | 80% |
| Phase 2 — Scanner & Google | ⬜ Not Started | 0% |
| Phase 3 — Polish & QA | ⬜ Not Started | 0% |
| Phase 4 — v1.1 Enhancements | ⬜ Not Started | 0% |

### Known Issues / Blockers
- Google Cloud Console project not yet created (blocks Phase 2).
- Hosting decision (on-premise vs. cloud VM) not yet finalised (blocks production setup).
- Team availability for Week 1 start date not confirmed.

---

## 14. Open Decisions (Unresolved)

These decisions must be made before the relevant phase begins. Track the answer here when resolved.

| # | Question | Needed By | Answer |
|---|---|---|---|
| 1 | Hosting: on-premise server or cloud VM (GCP/AWS)? | Before Phase 2 | ⬜ Unresolved |
| 2 | Single admin or multi-admin for v1? | Phase 1, Week 9 | ⬜ Unresolved |
| 3 | Max expected asset count (determines if SQLite is sufficient)? | Before build | ⬜ Unresolved |
| 4 | Finance read-only role needed in v1 or v2? | Phase 1 | ⬜ Unresolved |
| 5 | Are all 4 offices in scope at launch? | Phase 1, Week 1 | ⬜ Unresolved |
| 6 | Currency: USD only, or INR also needed? | Phase 1 | ⬜ Unresolved |
| 7 | Who owns Google Cloud Console / can create OAuth credentials? | Phase 2 | ⬜ Unresolved |
| 8 | Soft delete or hard delete for assets (current: hard)? | Phase 1 | ✅ Resolved → Hard delete (logs event first) |
| 9 | CSV import needed at launch or Phase 4? | Phase 1 | ⬜ Unresolved |
| 10 | Activity feed: persist to DB or compute from history table? | Phase 1 | ✅ Resolved → Compute from `asset_history` table |

---

## 15. Session Log

> Append a new entry at the start of each AI session. One line per session.
> Format: `YYYY-MM-DD | AI Tool | Session Goal | Outcome`

```
2026-07-21 | Claude (Anthropic) | Create all planning documentation (PRD, Architecture, Rules, Phases, Memory) | ✅ All 5 documents created and saved to Desktop
2026-07-21 | Antigravity AI | Phase 1, Week 1 — Monorepo setup, SQLite schema + seeder, Express server & route stubs, React Vite frontend with layout & dark mode tokens | ✅ Completed Week 1 setup; DB seeded with 15 assets/8 employees/4 categories; server running; frontend build verified
2026-07-21 | Antigravity AI | Phase 1, Week 2 — Backend Core APIs & Service Layer (`categories`, `employees`, `assets`, `history`, `serial`) with transactional lifecycle rules, conflict checks, and automated exit criteria verification | ✅ Completed Week 2 APIs; all endpoints verified via automated integration tests (`api.test.js`); strict architectural separation & validation enforced
2026-07-22 | Antigravity AI | Phase 1, Week 3 — Dashboard & Inventory Pages (`useMetrics`, `useAssets`, `MetricCard`, `InventoryBreakdown`, `ActivityFeed`, `SearchBar`, `FilterToolbar`, `AssetTable`) with live API connection, URL query sync, and UI primitives | ✅ Completed Week 3 pages & hooks; verified clean production build (`vite build` in 156ms) and 100% test verification across all filter & search combinations
2026-07-22 | Antigravity AI | Phase 1, Week 4 — Asset Detail Page & Lifecycle Actions (`SpecsProfile`, `HistoryTimeline`, `AssigneeCard`, `LifecycleActions`, `AssignmentModal`, `Button`, `Modal`, `useAsset`) | ✅ Completed Week 4 pages, modals, & hooks; verified clean production build (`vite build` in 116ms) and 100% E2E verification of assignment, return, notes edit, retirement, and Rule 1 boundaries
```

---

*This file is a living document. Keep it accurate. An outdated memory file is worse than no memory file.*

**Owner:** Engineering Lead  
**Updated by:** Any AI assistant or team member who makes a meaningful project decision.  
**Frequency:** Update after every session that changes code, decisions, or project state.
