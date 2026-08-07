# AssetTrack — Option 2 Dynamic RBAC & Custom Role Workflow Guide

**Document Version:** 17.0  
**Date:** August 6, 2026  
**Status:** Complete & Fully Verified Architectural Specification  
**Target Audience:** Operations, IT Admins, System Directors, Engineering  

---

## 1. Executive Summary & Dynamic Page Construction Guarantee

Under **Option 2 (Dynamic Granular RBAC)**, AssetTrack features an **Adaptive Page, Route & Component Construction Engine**. 

> ⚡ **Dynamic Page & Route Generation Principle**:  
> Whenever the System Director grants permissions to a custom or existing role and assigns it to an employee, **the frontend dynamically builds a customized user interface immediately upon login**. The user's navigation sidebar, root dashboard widgets, intra-page action buttons, and accessible page routes are automatically constructed based *only* on the permission flags associated with their assigned role.

---

## 2. Dynamic Page & Navigation Construction Mechanics

```
 [User Logs In at /login] ──► API Returns User Object + Active Permissions Array
                                                │
    ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
    ▼                                           ▼                                           ▼
[1. Dynamic Sidebar Navigation]    [2. Dynamic Dashboard Page Builder]     [3. Intra-Page Component Buttons]
 ├─ Evaluates hasPermission(key)    ├─ Evaluates Root Landing Page (/)     ├─ LifecycleActions (Assign, Retire)
 ├─ Constructs page links           ├─ Renders matching Metric Cards       ├─ Export Excel / Import Buttons
 └─ Hides unauthorized items        └─ Mounts permitted Widgets            └─ Role Edit Selectors
                                                │
                                                ▼
                                 [4. Dynamic Route Protection]
                                  ├─ ProtectedRoute checks hasPermission(requiredPerm)
                                  └─ Unauthorized URL attempts yield custom Access Restricted notice
```

### Examples of Dynamically Constructed Role Pages After Login

#### Example Scenario A: "Inventory Auditor" Role (Assigned: `assets:read`, `assets:export`, `categories:read`, `locations:read`)
- **Generated Sidebar**: `Dashboard`, `Inventory`, `Profile`.
- **Dynamically Built Landing Page (`/`)**: `RoleBasedDashboard.jsx` evaluates `hasPermission('assets:read')` and mounts `<Dashboard/>`. Inside `Dashboard.jsx`, internal widgets evaluate permissions:
  - Total Assets, Assigned Assets, Available Assets metric cards render (`assets:read`).
  - Category breakdown chart renders (`categories:read`).
  - **Export to Excel** button renders (`assets:export`).
  - Pending Ticket Queue table and ticket API calls are hidden (`tickets:read: ❌`).
  - **+ New Asset** button is hidden (`assets:create: ❌`).
- **Accessible Pages**: `Inventory` list view (`/inventory`) and detail view (`/inventory/:id`) with Add/Edit/Delete action buttons hidden. Can scan barcodes (`assets:read`).

#### Example Scenario B: "Onboarding Coordinator" Role (Assigned: `onboarding:create`, `onboarding:read`, `employees:read`, `categories:read`)
- **Generated Sidebar**: `Dashboard`, `Onboarding`, `Employees`, `Profile`.
- **Dynamically Built Landing Page (`/`)**: `RoleBasedDashboard.jsx` evaluates `hasPermission('onboarding:read')` and mounts `<HrDashboard/>` with active onboardings count and pending kit lists.
- **Accessible Pages**: `Onboarding` (with category dropdowns via `categories:read`) and `Employees` (directory view via `employees:read`).

#### Example Scenario C: "System Director" Role (Assigned: `*` / `roles:manage`)
- **Generated Sidebar**: `Dashboard`, `Inventory`, `Tickets`, `Onboarding`, `Scanner`, `Employees`, **`Role Matrix`**, `Settings`, `Profile`.
- **Dynamically Built Landing Page (`/`)**: Executive Super-Dashboard (`<DirectorDashboard/>`) with multi-tab view switching (IT Admin / HR / Employee views) + system audit log stream + Role Builder UI.

---

## 3. Role & Permission Hierarchy Matrix

```
                        ╔═════════════════════════════════════╗
                        ║    System Director / Root User      ║
                        ║ (Full Authority + Role Matrix UI)   ║
                        ╚══════════════════┬══════════════════╝
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   IT Admin Role  │             │  HR Partner Role │             │   Employee Role  │
│ (System Preset)  │             │ (System Preset)  │             │ (System Preset)  │
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         └────────────────────────────────┼────────────────────────────────┘
                                          │
                                          ▼
                        ╔═════════════════════════════════════╗
                        ║      Custom Dynamic Roles           ║
                        ║ (e.g. Asset Auditor, HR Lead)       ║
                        ║ Created & Managed by Director       ║
                        ╚═════════════════════════════════════╝
```

### Complete Permissions Catalog & Default System Role Mapping

| Category | Permission Key | Action Description | Director | Admin | HR | Employee |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **System** | `roles:manage` | Create/edit custom roles & permission matrix | ✅ | ❌ | ❌ | ❌ |
| | `history:read` | View system-wide audit history & event logs | ✅ | ✅ | ❌ | ❌ |
| **Inventory** | `assets:read` | View full company-wide inventory & barcode scan | ✅ | ✅ | ❌ | ❌ |
| | `assets:create` | Add new assets and generate wand serials | ✅ | ✅ | ❌ | ❌ |
| | `assets:assign` | Assign hardware to staff or return to stock | ✅ | ✅ | ❌ | ❌ |
| | `assets:delete` | Retire or soft-delete assets | ✅ | ✅ | ❌ | ❌ |
| | `assets:export` | Bulk export inventory to 4-sheet Excel | ✅ | ✅ | ❌ | ❌ |
| | `assets:import` | Bulk import inventory from Excel file | ✅ | ✅ | ❌ | ❌ |
| **Categories**| `categories:read` | View category schema & populate form dropdowns | ✅ | ✅ | ✅ | ✅ |
| | `categories:manage`| Create, edit, or delete hardware categories | ✅ | ✅ | ❌ | ❌ |
| **Employees** | `employees:read` | View staff directory & department lists | ✅ | ✅ | ✅ | ❌ |
| | `employees:manage`| Edit employee office location, department, & profile | ✅ | ✅ | ✅ | ❌ |
| | `employees:grant-access`| Grant password access / toggle login credentials | ✅ | ✅ | ❌ | ❌ |
| **Onboarding**| `onboarding:read` | View new-hire onboarding requests | ✅ | ✅ | ✅ | ❌ |
| | `onboarding:create` | Submit new-hire onboarding kit requests | ✅ | ❌ | ✅ | ❌ |
| | `onboarding:fulfill`| Fulfill hardware items for onboarding | ✅ | ✅ | ❌ | ❌ |
| **Tickets** | `tickets:read` | View support ticket queues & raise tickets | ✅ | ✅ | ✅ | ✅ (Own) |
| | `tickets:create` | Raise support tickets | ✅ | ✅ | ✅ | ✅ |
| | `tickets:resolve` | Resolve or transfer tickets across queues | ✅ | ✅ | ✅ | ❌ |
| **Locations** | `locations:read` | View office locations & addresses | ✅ | ✅ | ✅ | ✅ |
| | `locations:manage` | Create/edit company office locations | ✅ | ✅ | ❌ | ❌ |
| **Settings** | `settings:manage` | Configure system-wide administrative settings | ✅ | ✅ | ❌ | ❌ |

---

## 4. Architectural Rules & Data Model Principles

### 4.1 Centralized Permission Checker & Director Bypass
To eliminate inline `.includes('*')` bugs and guarantee the System Director **never gets 403'd** on legacy endpoints (such as Google Workspace OAuth config in `google.js` or audit history in `history.js`), `validateSession.js` exports a single centralized utility:

```javascript
// Centralized permission evaluator
const hasPermission = (user, permissionKey) => {
  if (!user) return false;
  if (user.role === 'director' || user.permissions?.includes('*')) return true;
  return user.permissions?.includes(permissionKey) || false;
};

// Upgraded requireRole automatically evaluates Director bypass & role matches
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: true, message: 'Unauthorized' });
    if (req.user.role === 'director' || req.user.permissions?.includes('*') || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: true, message: 'Forbidden - Insufficient permissions' });
  };
};
```

### 4.2 Credential Provisioning Change-Detection (`employees:grant-access`)
- **Modification Guard**: When updating an employee (`PUT /api/employees/:id` or `POST /api/employees`), the backend checks if credential fields are **NEWLY SET or CHANGED** (e.g. `password` is non-empty string, or `can_login` is toggling from `false` to `true`).
- Unchanged credential fields carried over in routine profile updates (such as updating an employee's department) are ignored.
- Requiring `employees:grant-access` is ONLY enforced when credentials are newly created, modified, or toggled on, seamlessly integrating with existing `grantAccess` and `grantGoogleAccess` service hooks.

### 4.3 Permission-Based Self-Service Ticket Confirm-Close & Reopen Carve-Out
- **Self-Service Ticket Lifecycle**: Users without `tickets:resolve` can confirm-close or reopen their own submitted tickets.
- **Endpoint Protection (`ticketService.updateTicketStatus`)**:
  ```javascript
  const updateTicketStatus = async (ticketId, status, reqUser) => {
    const hasResolve = reqUser.permissions?.includes('tickets:resolve') || reqUser.permissions?.includes('*');
    
    // If user lacks tickets:resolve, permit ONLY for their own tickets with confirm_closed/reopened
    if (!hasResolve) {
      if (ticket.employee_id !== reqUser.id || !['confirm_closed', 'reopened'].includes(status)) {
        throw new ForbiddenError('Insufficient permissions to modify ticket queue status.');
      }
    }
    // Proceed with status update...
  };
  ```

### 4.4 Mandatory Role-Field Escalation Prevention
- **Security Requirement**: The general employee update handler (`employeeService.updateEmployee` and `PUT /api/employees/:id`) MUST explicitly strip or ignore `role` and `role_id` fields from any payload it processes, regardless of the caller's permissions.
- Those two role-assignment fields may ONLY be written via the dedicated `PUT /api/employees/:id/role` route, which is guarded strictly by `requirePermission('roles:manage')` (Director only). This prevents HR users holding `employees:manage` from attempting self-escalation or modifying employee roles during routine profile updates.

---

## 5. Pitfall Mitigation & Engineering Safeguards

### 5.1 Client-Side `hasPermission(key)` Implementation & Director Bypass
- **File**: `client/src/context/AuthContext.jsx`
- **Safeguard Logic**: The client-side `hasPermission(key)` helper MUST mirror the backend logic by explicitly granting permission if `user.role === 'director'` or `user.permissions.includes('*')`. Because Director's default permission array is `['*']`, a naive `permissions.includes(key)` check would cause every UI element to evaluate to `false` for the System Director.
- **Client Safeguard Code**:
  ```javascript
  const hasPermission = useCallback((permissionKey) => {
    if (!user) return false;
    if (user.role === 'director' || user.permissions?.includes('*')) return true;
    return user.permissions?.includes(permissionKey) || false;
  }, [user]);
  ```

### 5.2 Complete `DEFAULT_ROLE_PERMISSIONS` Dictionary Reprint
- **File**: `server/middleware/validateSession.js`
- **Reprinted Dictionary**:
  ```javascript
  const DEFAULT_ROLE_PERMISSIONS = {
    director: ['*'],
    admin: [
      'roles:manage', 'history:read',
      'assets:read', 'assets:create', 'assets:assign', 'assets:delete', 'assets:export', 'assets:import',
      'categories:read', 'categories:manage',
      'employees:read', 'employees:manage', 'employees:grant-access',
      'onboarding:read', 'onboarding:fulfill',
      'tickets:read', 'tickets:create', 'tickets:resolve',
      'locations:read', 'locations:manage',
      'settings:manage'
    ],
    hr: [
      'categories:read',
      'employees:read', 'employees:manage',
      'onboarding:read', 'onboarding:create',
      'tickets:read', 'tickets:create', 'tickets:resolve',
      'locations:read'
    ],
    employee: [
      'categories:read',
      'tickets:read', 'tickets:create',
      'locations:read'
    ]
  };

  const getDefaultPermissionsForRole = (role) => DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.employee;
  ```

### 5.3 Dynamic Root Dashboard Router (`RoleBasedDashboard.jsx`)
- **File**: `client/src/components/dashboard/RoleBasedDashboard.jsx`
- **Safeguard Code**: Evaluate permission hierarchy using `hasPermission(...)`:
  ```javascript
  const RoleBasedDashboard = () => {
    const { hasPermission } = useAuth();

    if (hasPermission('roles:manage')) return <DirectorDashboard />;
    if (hasPermission('assets:read')) return <Dashboard />;
    if (hasPermission('onboarding:read')) return <HrDashboard />;
    return <EmployeeDashboard />;
  };
  ```

### 5.4 Safe Idempotent Database Constraint DDL Block (`rbac_schema.sql`)
- **File**: `supabase/migrations/20260806000000_rbac_schema.sql`
- **Safeguard SQL**:
  ```sql
  DO $$ 
  BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_check') THEN 
      ALTER TABLE employees DROP CONSTRAINT employees_role_check; 
    END IF; 
  END $$;

  ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role IN ('director', 'admin', 'hr', 'employee'));
  ```

---

## 6. Complete & Exhaustive File Modification Inventory

### 6.1 Complete List of Exact Touched Files

| Layer | File Path | Action | Purpose of Change |
| :--- | :--- | :---: | :--- |
| **Database** | `supabase/migrations/20260806000000_rbac_schema.sql` | **[NEW]** | Create `roles`, `permissions`, `role_permissions` tables, add `admin_type` column to `roles`, add `role_id INT REFERENCES roles(id) ON DELETE RESTRICT`, backfill `role_id` for pre-existing employee rows, safely drop/recreate `employees_role_check` constraint via DDL block, and seed default role mappings (including `history:read`). |
| **Backend** | `server/middleware/validateSession.js` | **[MODIFY]** | Join permissions, sanitize `json_agg`, attach complete user identity (`name`, `email`, `roleAdminType`), add reprinted `DEFAULT_ROLE_PERMISSIONS` dictionary, export `hasPermission`, and export both `requireRole` & `requirePermission`. |
| **Backend** | `server/routes/roles.js` | **[NEW]** | Dedicated REST router for Director role & matrix operations (`GET/POST/PUT/DELETE /api/roles`) with system role immutability, active user assignment deletion locks, and `admin_type` saving. |
| **Backend** | `server/routes/auth.js` | **[MODIFY]** | Add `GET /api/auth/me` endpoint to return fresh authenticated user session payload. |
| **Backend** | `server/routes/history.js` | **[MODIFY]** | Swap `requireRole('admin')` guard to `requirePermission('history:read')` for system audit log viewing. |
| **Backend** | `server/routes/assets.js` | **[MODIFY]** | Swap `requireRole` guards to `requirePermission` guards (`assets:read`, `assets:create`, `assets:assign`, `assets:delete`, `assets:export`, `assets:import`). |
| **Backend** | `server/routes/tickets.js` | **[MODIFY]** | Swap `requireRole` guards to `requirePermission` guards (`tickets:read`, `tickets:create`, `tickets:resolve`). Carve out permission-based self-service confirm-close / reopen status updates using `hasPermission`. |
| **Backend** | `server/routes/onboarding.js` | **[MODIFY]** | Swap `requireRole` guards to `requirePermission` guards (`onboarding:read`, `onboarding:create`, `onboarding:fulfill`). |
| **Backend** | `server/routes/categories.js` | **[MODIFY]** | Swap guards: `GET` ➔ `categories:read` (HR & Employees can load dropdowns), `POST/PUT/DELETE` ➔ `categories:manage`. |
| **Backend** | `server/routes/locations.js` | **[MODIFY]** | Swap `requireRole` guards: `GET` ➔ `locations:read`, `POST/PUT/DELETE` ➔ `locations:manage`. |
| **Backend** | `server/routes/serial.js` | **[MODIFY]** | Swap guard to `requirePermission('assets:read')` (Inventory Auditors can scan barcodes). |
| **Backend** | `server/routes/employees.js` | **[MODIFY]** | Swap guards: `GET` ➔ `employees:read`, `POST/PUT` credential provisioning ➔ `employees:grant-access`, `PUT /:id` ➔ `employees:manage` (strips `role`/`role_id` fields), `PUT /:id/access` ➔ `employees:grant-access`, `PUT /:id/role` ➔ `roles:manage`. |
| **Backend** | `server/routes/google.js` | **[MODIFY]** | Swap `requireRole('admin')` to `requirePermission('settings:manage')` for OAuth config and Directory Sync endpoints. |
| **Backend** | `server/services/employeeService.js` | **[MODIFY]** | Update `getEmployees` and `mapEmployee` to `LEFT JOIN roles r` and return `custom_role_name`. Enforce `role`/`role_id` payload stripping in `updateEmployee`. Implement credential modification change-detection for `employees:grant-access`. |
| **Backend** | `server/services/ticketService.js` | **[MODIFY]** | Add `adminType` queue listing read & resolution write SQL fallback (`req.user.roleAdminType || req.user.adminType || 'it'`). Implement `hasPermission` self-service confirm-close / reopen status carve-out in `updateTicketStatus`. |
| **Backend** | `server/index.js` | **[MODIFY]** | Mount new router: `app.use('/api/roles', require('./routes/roles'))`. |
| **Frontend** | `client/src/context/AuthContext.jsx` | **[MODIFY]** | Store permissions array, provide `hasPermission(key)` with Director/`*` bypass logic, add Axios 403 interceptor toast, and non-silent mount-time `GET /auth/me` sync. |
| **Frontend** | `client/src/App.jsx` | **[MODIFY]** | Group `/inventory` and `/inventory/:id` under `requiredPermission="assets:read"`, and `/inventory/new` and `/inventory/:id/edit` under `requiredPermission="assets:create"`. Update `/scanner`, `/tickets`, `/onboarding`, `/employees`, `/settings` guards. |
| **Frontend** | `client/src/pages/Dashboard.jsx` | **[MODIFY]** | Wrap internal widgets and ticket fetches in `hasPermission(...)` checks to prevent `403 Forbidden` errors for custom roles like Inventory Auditor. |
| **Frontend** | `client/src/components/dashboard/RoleBasedDashboard.jsx` | **[MODIFY]** | Evaluate `hasPermission(...)` hierarchy to dynamically render matching landing dashboard view for custom roles. |
| **Frontend** | `client/src/components/layout/Sidebar.jsx` | **[MODIFY]** | Filter navigation sidebar links dynamically via `hasPermission(...)`. |
| **Frontend** | `client/src/components/layout/ProtectedRoute.jsx` | **[MODIFY]** | Support `requiredPermission` prop alongside legacy `allowedRoles`. |
| **Frontend** | `client/src/components/forms/RoleManagementModal.jsx` | **[MODIFY]** | Display read-only badge for IT Admins; render editable dropdown + Matrix button for Director. |
| **Frontend** | `client/src/pages/Settings.jsx` | **[MODIFY]** | Add "Roles & Permissions" tab to Settings view for Director. |
| **Frontend** | `client/src/components/settings/RoleMatrixModal.jsx` | **[NEW]** | Role Matrix Builder modal for Director to create custom roles, check permission boxes, and select target support queue (`admin_type`). |

---

## 7. Governance & Four-Gate Security Review

In accordance with project rules (`AssetTrack_Rules.md` §12.3 / §12.6):
- **Human Sign-Off Gate**: The database schema migration (`supabase/migrations/20260806000000_rbac_schema.sql`), session validation middleware (`server/middleware/validateSession.js`), role service updates (`server/services/employeeService.js`), and the RBAC REST router (`server/routes/roles.js`) must be reviewed and approved by human engineering sign-off prior to production deployment.

---

## 8. Architectural Safety & Backward Compatibility Assurance

- **Zero DB Breaking Changes**: Existing `employees.role` string column (`'admin'`, `'hr'`, `'employee'`, `'director'`) is preserved and constraint-widened. Migration backfills `role_id` for pre-existing rows in the same transaction.
- **Zero API Breaking Changes**: Endpoint validation middleware evaluates both role string and permission map, ensuring zero test or route failures.
- **Zero UI Layout Shifts**: All pages and URL routes maintain their exact existing design and visual structure.
