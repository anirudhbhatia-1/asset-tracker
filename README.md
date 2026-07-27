# AssetTrack — IT Asset Management & Service Portal

AssetTrack is an enterprise-grade internal web application engineered for IT Administrators, HR Professionals, and Employees. It provides end-to-end hardware inventory management, self-service IT ticketing, and streamlined HR onboarding workflows across multiple regional offices (Bangalore, Mumbai, Delhi, Hyderabad).

---

## Tech Stack & Architecture Overview

### Core Technologies
- **Frontend (`/client`)**: React 18 (Vite), Tailwind CSS v4, Lucide Icons, Axios, React Router v6, React Hot Toast
- **Backend (`/server`)**: Node.js v20+, Express v5, `pg` (Postgres driver), `express-validator`
- **Database**: Supabase Postgres (via connection pooler)
- **Testing**: Vitest (`vitest`) & Supertest (`supertest`) across frontend unit tests and backend API integration tests

### Architectural Pattern: Pattern 2 (Axios -> Hooks -> Components)
The frontend architecture enforces **Pattern 2: API Layer $\rightarrow$ Custom Hooks $\rightarrow$ Component UI**:
1. **API Layer (`/client/src/api/`)**: Centralized Axios wrappers (`assetsApi.js`, `employeesApi.js`, `categoriesApi.js`, `historyApi.js`) handling base URLs, serialization, and error response transformations.
2. **State & Mutation Hooks (`/client/src/hooks/`)**: Custom React hooks (`useAsset.js`, `useAssets.js`, `useEmployees.js`, `useCategories.js`, `useHistory.js`) encapsulating data fetching, loading/skeleton state, error states, and optimistic UI updates/refreshes.
3. **Component Layer (`/client/src/components/` & `/client/src/pages/`)**: Pure UI presentation components rendering dark-mode flat UIs, loading skeletons, empty states with CTAs, and triggering hook actions (`assignAsset`, `returnAsset`, `retireAsset`).

---

## Getting Started

### Prerequisites
- Node.js 20.x LTS or higher
- npm 10.x or higher

### One-Command Setup & Launch (Monorepo Root)
The monorepo root includes `concurrently` for seamless development startup:

```bash
# 1. Install root dependencies and trigger recursive postinstall for both client & server
npm install

# 2. Copy example environment files
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Start both backend API server (port 3001) and frontend Vite server (port 5173) simultaneously
npm run dev
```

Open `http://localhost:5173` in your browser. The application is secured via JWT authentication. The database is automatically seeded with users across all three roles.

### Test Accounts
You can log in with any of the following accounts (the password for all test accounts is `password`):
- **Admin**: `admin@company.com` (Full access to Inventory, Scanning, and Settings)
- **Employee**: `employee@company.com` (Access to personal Dashboard and IT Ticketing)
- **HR**: `hr@company.com` (Access to new hire Onboarding workflows)

### Running Automated Suite (Unit & Integration Tests)
Run the 100% passing test suite across both server and client:
```bash
# Run server unit tests (assetService) and API integration tests (Supertest)
npm test --prefix server

# Run client unit tests (serialGenerator & formatters)
npm test --prefix client
```

---

## API Endpoints Table

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/metrics` | Summary KPIs (total, assigned, available, maintenance, total valuation) |
| `GET` | `/api/assets` | List all assets with optional filtering (`status`, `categoryId`, `location`, `q`) |
| `POST` | `/api/assets` | Register a new asset (auto-checks unique serial & creates audit log) |
| `GET` | `/api/assets/:id` | Fetch single asset details with complete chronological audit timeline |
| `PUT` | `/api/assets/:id` | Update asset metadata (name, category, cost, location, notes) |
| `DELETE` | `/api/assets/:id` | Permanently delete asset record (`confirm: true` required in body) |
| `POST` | `/api/assets/:id/assign` | Assign available asset to employee (`status` transitions to `in-use`) |
| `POST` | `/api/assets/:id/return` | Return assigned asset back to IT stock (`status` transitions to `available`) |
| `POST` | `/api/assets/:id/retire` | Decommission asset (`confirm: true` required, `status` transitions to `retired`) |
| `GET` | `/api/assets/:id/history` | Get full chronological audit trail (`history` table) for an asset |
| `GET` | `/api/employees` | List all active employees (`?location=`, `?department=`, `?q=`) |
| `GET` | `/api/employees/:id` | Fetch employee details along with all currently assigned assets |
| `POST` | `/api/employees` | Create a new employee directory entry |
| `DELETE` | `/api/employees/:id` | Soft-delete employee (`deleted_at = CURRENT_TIMESTAMP`) |
| `PATCH` | `/api/employees/:id/role` | Update an employee's role (admin/hr/employee) |
| `POST` | `/api/employees/:id/grant-access` | Grant login access (creates a user account for the employee) |
| `POST` | `/api/auth/login` | Authenticate and retrieve a session token |
| `POST` | `/api/auth/logout` | Invalidate current session token |
| `GET` | `/api/tickets` | List IT tickets (supports RBAC isolation) |
| `POST` | `/api/tickets` | Create a new IT ticket |
| `PATCH` | `/api/tickets/:id/resolve` | Resolve an IT ticket (Admin only) |
| `GET` | `/api/onboarding` | List onboarding requests (HR/Admin only) |
| `POST` | `/api/onboarding` | Create a new onboarding request |
| `PATCH` | `/api/onboarding/:id/arrange` | Arrange IT assets for a new hire |
| `GET` | `/api/categories` | List hardware classification categories with counts |
| `POST` | `/api/categories` | Create new classification category (`name`, `badgeChar`, `color`) |
| `DELETE` | `/api/categories/:id` | Delete category (blocked if active assets reference it) |
| `GET` | `/api/history` | Global activity feed across all devices (with limit/pagination) |
| `GET` | `/api/serial/scan/:serial` | Check serial number uniqueness during barcode or manual entry |

---

## Assumptions & Design Decisions Log

Every technical implementation strictly conforms to the foundational engineering memory records:
1. **Decision 1 (Soft Deletes vs Hard Deletes)**: Employees are **soft-deleted** (`deleted_at` timestamp) to preserve historical integrity for audit trails and past asset assignments. Assets are **hard-deleted** when explicitly removed (`deleteAsset`), but their audit trails are logged right before deletion.
2. **Decision 2 (Supabase Postgres via `pg`)**: All database operations execute asynchronously using `pg` connection pools and atomic `db.withTransaction()` blocks, preventing race conditions or partial state updates during multi-table lifecycle mutations.
3. **Decision 3 (Audit Logging Philosophy)**: Every asset lifecycle event (`created`, `assigned`, `returned`, `retired`, `updated`, `deleted`) is logged atomically within the same database transaction as the asset status update, guaranteeing zero drift between `assets.status` and `history`.
4. **Decision 4 (Assigned Asset Constraints)**: If an asset is `assigned` during creation (`status: 'in-use'`), both a `created` and `assigned` event are written atomically. Retired assets (`status: 'retired'`) are locked and cannot be re-assigned or returned (`Rule 1`).
5. **Decision 5 (Flat Dark UI & Skeletons)**: UIs avoid heavy drop shadows (`Rule 10`), using crisp 1px borders (`border-slate-700/60`), muted slate backgrounds (`bg-slate-800`), and smooth pulse skeletons (`SkeletonCard`) instead of spinning loaders during data queries.
6. **Decision 6 (Offline & Background Polling)**: The global `OfflineBanner` alerts users when network connectivity is lost. `useHistory` polls activity logs every 60 seconds and re-fetches on window focus (`isBackground: true`) without jarring full-screen loading flickers.

---

## Project Structure
```
comppro/ (Monorepo Root)
├── package.json          # Root scripts (`npm run dev` via concurrently)
├── client/               # React 18 / Tailwind v4 Vite Frontend
│   ├── src/
│   │   ├── api/          # Axios API wrappers
│   │   ├── components/   # UI components (dashboard, inventory, asset-detail, employees, layout, ui)
│   │   ├── hooks/        # State management hooks (useAssets, useAsset, useEmployees, useCategories, useHistory)
│   │   ├── pages/        # Route pages (Dashboard, Inventory, AssetDetail, AddEditAsset, Employees, Categories)
│   │   └── utils/        # Utilities (serialGenerator, formatters)
│   └── package.json
├── server/               # Node.js Express Backend
│   ├── middleware/       # Error handler & request validators
│   ├── routes/           # REST endpoints (assets, dashboard, employees, categories, history, serial)
│   ├── services/         # Business logic & Postgres transactions (assetService, historyService, etc.)
│   ├── tests/            # Vitest unit & Supertest integration tests
│   └── db.js             # Postgres pool initialization & connection helper
├── backups/              # Automatic daily/manual database backups directory
└── README.md
```
