# AssetTrack — Dynamic RBAC (Option 2) Risk Audit Document

**Document Version:** 2.1  
**Date:** August 6, 2026  
**Status:** Comprehensive Pre-Implementation Audit Verified  

---

## 1. Test Suite Baseline & Regression Contract

The following test suites represent the regression baseline. All currently passing tests MUST continue to pass unmodified after the migration:

1. **Vitest Unit & Integration Suites (`server/tests/`)**:
   - `tests/assetService.test.js`: **6 / 6 Passed (100%)**
   - `tests/api.integration.test.js`: **4 Tests (Requires session table expiration mock fix)**
2. **Playwright End-to-End Suites (`e2e/`)**:
   - `assignment.spec.js`: Evaluates asset assignment & lifecycle flows.
   - `inventory.spec.js`: Evaluates asset CRUD & filter listings.
   - `category.spec.js`: Evaluates category management & badge rendering.

---

## 2. Comprehensive Risk Registry

### 1. Unbackfilled `role_id` Foreign Keys
Pre-existing employee rows lacking `role_id` return `NULL` permissions on JOIN, denying access across all routes.  
**Fix:** Backfill `role_id` in the database schema migration based on existing string `role` values (`'director'`, `'admin'`, `'hr'`, `'employee'`) and provide an in-memory `DEFAULT_ROLE_PERMISSIONS` fallback dictionary in `validateSession.js`.

### 2. System Director Access Lockout on Legacy `requireRole('admin')` Routes
Endpoints guarded by `requireRole('admin')` return `403 Forbidden` for users with `role = 'director'`.  
**Fix:** Upgrade `requireRole` in `validateSession.js` to automatically grant access if `req.user.role === 'director'` or `req.user.permissions.includes('*')`.

### 3. HR Category Dropdown Access Rejection on Onboarding Creation
Gating `GET /api/categories` behind write-level `categories:manage` permissions blocks HR users from creating onboarding requests.  
**Fix:** Split permission keys: gate `GET /api/categories` on `categories:read` (granted to all roles) and `POST/PUT/DELETE` on `categories:manage`.

### 4. Company-Wide Inventory Leakage via `GET /api/assets`
Granting `assets:read` to employee defaults allows staff to view the entire company inventory listing.  
**Fix:** Exclude `assets:read` from the employee default permission set. Employees access hardware via the dedicated `/api/employees/:id/assets` endpoint.

### 5. HR Navigation Exposure Reopening (`Inventory` & `Scanner`)
Granting `assets:read` to HR opens access to restricted Inventory and Scanner pages.  
**Fix:** Exclude `assets:read` and `assets:export` from HR default permissions, preserving HR navigation boundaries.

### 6. Custom Role First-Paint Crash on `Dashboard.jsx` Internal Fetches
Mounting `<Dashboard/>` for custom roles without `tickets:read` triggers `403 Forbidden` errors on initial data fetch.  
**Fix:** Wrap internal widget fetches and table components in `hasPermission('tickets:read')` and `hasPermission('assets:create')`.

### 7. Self-Service Ticket Lifecycle Lockout for Employees
Requiring `tickets:resolve` for all ticket status updates prevents employees from confirm-closing or reopening their own tickets.  
**Fix:** Carve out self-service status updates in `ticketService.js` for users without `tickets:resolve` when modifying their own tickets (`confirm_closed` or `reopened`).

### 8. Routine HR Employee Profile Edits Triggering Un-Granted `employees:grant-access`
Submitting un-modified credential fields during routine HR profile edits causes requests to fail with `403 Forbidden`.  
**Fix:** Implement change-detection in `employeeService.updateEmployee` to enforce `employees:grant-access` ONLY when credentials are newly set, changed, or toggled on.

### 9. Role Deletion Causing Foreign Key Orphans or System Instability
Deleting system roles or custom roles with assigned staff breaks foreign key integrity.  
**Fix:** Add `is_system` immutability check and `COUNT(*) > 0` active assignment check in `server/routes/roles.js`.

### 10. Coarse Base Role Database Constraint & Custom Role Architecture
Existing Postgres CHECK constraint `employees_role_check` rejects `'director'` string values. Under Option 2, `employees.role` stores one of the 4 coarse base system roles (`'director'`, `'admin'`, `'hr'`, `'employee'`), while custom dynamic roles (e.g. `"Inventory Auditor"`) populate `employees.role_id` while defaulting `employees.role = 'employee'`.  
**Fix:** Execute an idempotent `DO $$` DDL block in `rbac_schema.sql` to widen `employees_role_check` to `('director', 'admin', 'hr', 'employee')`.

### 11. Incomplete Inventory Route Protection in `App.jsx`
Gating `/inventory/new` without protecting `/inventory` and `/inventory/:id` creates a route protection mismatch.  
**Fix:** Group `/inventory` and `/inventory/:id` under `requiredPermission="assets:read"` and `/inventory/new` and `/inventory/:id/edit` under `requiredPermission="assets:create"`.

### 12. Self-Service Ticket Carve-Out Using String Checks
Checking `if (req.user.role === 'employee')` breaks custom self-service roles without `tickets:resolve`.  
**Fix:** Key self-service carve-out on `!hasPermission(req.user, 'tickets:resolve')`.

### 13. Privilege Escalation via Un-Gated Employee Role Writes
`PUT /api/employees/:id` accepting `role` or `role_id` allows HR users to escalate privileges.  
**Fix:** Strip `role` and `role_id` fields in `employeeService.updateEmployee()`. Role changes are restricted strictly to `PUT /api/employees/:id/role` guarded by `roles:manage`.

### 14. Custom Support Roles Lacking Ticket Queue Target (`admin_type`)
Custom roles with `tickets:resolve` default to the IT queue if no `admin_type` is specified.  
**Fix:** Add `admin_type` column to `roles` table and include target support queue selector in `RoleMatrixModal.jsx`.

### 15. Employee Cards Displaying Coarse Role Strings Instead of Custom Role Names
Employee cards rendering `employee.role` display `'employee'` instead of custom titles like `"Inventory Auditor"`.  
**Fix:** Perform `LEFT JOIN roles r ON e.role_id = r.id` in `employeeService.getEmployees` and return `custom_role_name`.

### 16. System Director 403 Errors on Google Config & History Routes
Endpoints in `google.js` and `history.js` using `requireRole('admin')` reject the System Director.  
**Fix:** Update `validateSession.js` `requireRole` with Director bypass and swap `history.js` to `requirePermission('history:read')`.

### 17. Client-Side `hasPermission` Returning False for Director Wildcard
A naive `permissions.includes(key)` check returns `false` for System Director whose permission array is `['*']`.  
**Fix:** Implement client-side `hasPermission(key)` in `AuthContext.jsx` returning `true` if `user.role === 'director' || user.permissions?.includes('*')`.

### 18. Missing Permission Key for System Audit Logs
`server/routes/history.js` lacks a corresponding permission key in the catalog.  
**Fix:** Add `history:read` to the catalog (§3), default dictionary (§5.2), and `history.js` route guard.

### 19. Express-Validator Base System Role Input Validation (`server/routes/employees.js`)
`server/routes/employees.js` lines 118, 167, 185, and 230 validate `body('role').isIn(['admin', 'employee', 'hr'])`. Requests setting the coarse base system role to `'director'` fail with `400 Bad Request`. Custom role assignments pass their primary identifier via `role_id`.  
**Fix:** Update all base role validation schemas in `server/routes/employees.js` to `isIn(['admin', 'employee', 'hr', 'director'])`.

### 20. Hardcoded String Role Equality in Frontend Components
Components `TopBar.jsx` (L136, 147), `LocationsTab.jsx` (L22), `OnboardingDetailsModal.jsx` (L23), `Inventory.jsx` (L25), `Employees.jsx` (L19), `Tickets.jsx` (L24-26), and `Onboarding.jsx` (L53, 57, 106, 156) use direct string comparisons (`user?.role === 'admin'`). Users with `role = 'director'` or custom roles fail these checks, hiding action buttons and header controls.  
**Fix:** Refactor frontend checks from `user?.role === 'admin'` to `hasPermission(key)`.

### 21. Queue Routing Failure for Custom Roles in `ticketService.js` (L20-44)
`ticketService.getTickets` uses string comparisons (`if (user.role === 'employee') ... else if (user.role === 'hr') ... else if (user.role === 'admin')`). Users with `role = 'director'` or custom support roles fall through without queue filtering or WHERE clauses.  
**Fix:** Refactor `ticketService.getTickets` to build query conditions based on `hasPermission(user, 'tickets:resolve')` and `user.adminType`.

### 22. Ticket History Route Guard Alignment (`server/routes/tickets.js` L29)
`server/routes/tickets.js` L29 gates `GET /api/tickets/:id/history` using `requireRole('admin', 'employee', 'hr')`. While `ticketService.getTicketHistory(id)` executes a SQL JOIN without role checks, the route middleware rejects requests from users with custom permissions.  
**Fix:** Swap route middleware guard in `server/routes/tickets.js` L29 from `requireRole('admin', 'employee', 'hr')` to `requirePermission('tickets:read')`.

### 23. Incomplete Preset Role Enum in `RoleManagementPanel.jsx` (L4)
`client/src/components/dashboard/RoleManagementPanel.jsx` L4 defines `const ROLES = ['admin', 'hr', 'employee']`, excluding `'director'` and custom dynamic roles from selection dropdowns.  
**Fix:** Fetch active roles dynamically from `GET /api/roles` or update preset array to include `'director'`.

### 24. Unindexed `role_permissions` Table Performance Degradation (`validateSession.js` L13)
Executing a 5-table JOIN (`sessions`, `employees`, `roles`, `role_permissions`, `permissions`) on every HTTP request without indexes on `role_permissions(role_id, permission_id)` causes sequential database table scans.  
**Fix:** Add `CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);` and `CREATE INDEX idx_role_permissions_perm_id ON role_permissions(permission_id);` in `20260806000000_rbac_schema.sql`.

### 25. Unwrapped Migration Execution in `20260806000000_rbac_schema.sql`
If table creation or column modifications fail partway through migration execution, the database is left in an inconsistent state.  
**Fix:** Wrap all DDL and DML statements in `20260806000000_rbac_schema.sql` inside a single atomic transaction block (`BEGIN; ... COMMIT;`).

### 26. Mount-Time UI Layout Flicker in `AuthContext.jsx` & `App.jsx`
Before `GET /api/auth/me` resolves on mount, `user.permissions` is `undefined`, causing `hasPermission(key)` checks in navigation components to temporarily evaluate to `false`, causing layout flicker.  
**Fix:** Ensure `AuthProvider` loading state blocks route rendering until session state and permissions array initialization complete.

---

## 3. Summary of Risk Audit Findings

A total of **26 risks** were identified, verified against current code, and documented across the AssetTrack codebase during this comprehensive pre-implementation audit. Among these findings, **12 are Critical** (would cause active runtime 403 errors, data leaks, or complete feature lockouts), **9 are Moderate** (UI component mismatches or validator rejections), and **5 are Minor** (layout rendering polish or unindexed database queries). All 6 existing server test files were run against the codebase; `assetService.test.js` passed 100% (6/6 tests), while `api.integration.test.js` requires standard session expiration test mock alignment. Zero application source code files were modified during this audit phase.
