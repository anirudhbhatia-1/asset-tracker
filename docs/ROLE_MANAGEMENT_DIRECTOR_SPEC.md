# AssetTrack — Director / Root User & Dynamic RBAC Architectural Specification

**Document Version:** 1.0  
**Date:** August 6, 2026  
**Status:** Architectural Proposal & Feasibility Report  
**Target Audience:** Product, Engineering, Lead Architect  

---

## Executive Summary

This document presents a comprehensive architectural and engineering breakdown to implement higher-tier access control for **AssetTrack**. The user requirement proposes two distinct architectural strategies:

- **Option 1: Fixed 4-Tier Hierarchy (`director` / `rootuser`)**  
  Adds a `director` role above `admin`, `hr`, and `employee`. Strips role modification privileges from `admin` (making role changes exclusive to `director`), while giving `director` super-admin access across all system modules.
- **Option 2: Dynamic Granular RBAC & Custom Role Creator**  
  Implements a permission matrix engine where the `director` can create custom roles dynamically, assign fine-grained permissions (`inventory:read`, `onboarding:write`, `roles:manage`, etc.), and dynamically construct navigation sidebars, pages, and dashboard widgets.

Both approaches preserve existing user workflows for `admin`, `hr`, and `employee` with zero breaking changes.

---

## 1. Current State Assessment

In the current codebase:
- **Database Schema**: `employees.role` is an `VARCHAR(20)` column supporting `'admin'`, `'hr'`, `'employee'`.
- **Backend Middleware**: Checks `req.user.role` via `requireRole('admin', 'hr')` in `server/middleware/validateSession.js`.
- **Frontend Routing**: `App.jsx` uses `<ProtectedRoute allowedRoles={['admin']}>` and renders `<RoleBasedDashboard />` based on `user.role`.
- **Role Editing**: Currently, `admin` users can edit roles in `client/src/components/forms/RoleManagementModal.jsx` and `server/routes/employees.js`.

---

## 2. Option 1: Fixed 4-Tier Hierarchy (`director` / `rootuser`)

### 2.1 Core Rules & Behavior Changes
1. **Role Access Expansion**: Database enum/VARCHAR check expanded to support `'director'` (or `'rootuser'`).
2. **Role Management Privilege Removal from `admin`**:
   - `admin` users can no longer edit employee roles, change `admin_type`, or grant Google login credentials.
   - `server/routes/employees.js` (`PUT /:id/role`) restricts access exclusively to `requireRole('director')`.
3. **Super-Admin Access for `director`**:
   - `director` passes all `requireRole('admin')`, `requireRole('hr')`, and `requireRole('employee')` middleware checks automatically.
   - `director` gets access to all routes: `/inventory`, `/onboarding`, `/tickets`, `/scanner`, `/employees`, `/settings`, `/profile`.
4. **Director Dashboard**:
   - Renders a multi-tab consolidated dashboard view allowing switching between **IT Admin View**, **HR View**, and **Employee View**, plus a dedicated **Executive System Health & Audit Widget**.

### 2.2 Database Schema Updates (Option 1)
```sql
-- Migration: Add 'director' role constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role IN ('director', 'admin', 'hr', 'employee'));

-- Optional: Seed default Director account
INSERT INTO employees (name, email, role, admin_type, created_at)
VALUES ('System Director', 'director@company.com', 'director', 'it', NOW())
ON CONFLICT (email) DO UPDATE SET role = 'director';
```

### 2.3 Backend Middleware Adjustments (Option 1)
Update `requireRole` in `server/middleware/validateSession.js` to automatically grant `director` access to any protected endpoint:

```javascript
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Unauthorized', code: 401 });
    }
    // Director bypasses all role checks (Super Admin)
    if (req.user.role === 'director' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: true, message: 'Forbidden - Insufficient permissions', code: 403 });
  };
};
```

### 2.4 Frontend Changes (Option 1)
- **`Sidebar.jsx`**: Displays all navigation links (`Inventory`, `Tickets`, `Onboarding`, `Scanner`, `Employees`, `Settings`) when `user.role === 'director'`.
- **`RoleManagementModal.jsx`**: Only rendered or enabled when `user.role === 'director'`. Admins attempting to view role management see a read-only badge.

---

## 3. Option 2: Dynamic Granular RBAC & Custom Role Creator Matrix

### 3.1 Core Rules & Architecture Overview
Instead of hardcoding role strings, Option 2 decouples **Roles** from **Permissions**:
- **Permissions**: Atomic string keys representing system actions (e.g. `assets:read`, `assets:create`, `assets:assign`, `onboarding:manage`, `tickets:resolve`, `roles:manage`, `settings:manage`).
- **Roles**: Custom named entities (e.g., "Director", "IT Admin", "Asset Manager", "HR Partner", "Employee"). Each role is assigned a array of permissions.
- **Dynamic Page Construction**: Frontend routes, sidebar links, and dashboard widgets render conditionally based on whether the logged-in user possesses the required permission flags.

### 3.2 Database Schema Architecture (Option 2)

```sql
-- 1. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,       -- e.g. 'assets:create'
  name VARCHAR(100) NOT NULL,            -- e.g. 'Create Assets'
  category VARCHAR(50) NOT NULL,          -- e.g. 'Inventory'
  description TEXT
);

-- 2. Custom Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,       -- e.g. 'director', 'admin', 'hr', 'employee', 'auditor'
  name VARCHAR(100) NOT NULL,            -- e.g. 'IT Support Manager'
  is_system BOOLEAN DEFAULT FALSE,       -- Immutable system defaults
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Role-Permission Junction Table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Update Employees Table to reference roles table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);
```

### 3.3 Granular Permissions Matrix

| Category | Permission Key | Description | Default System Roles |
| :--- | :--- | :--- | :--- |
| **System** | `roles:manage` | Create/edit custom roles & assign permissions | Director Only |
| **Inventory** | `assets:read` | View hardware inventory list and details | Director, Admin, HR, Employee |
| | `assets:create` | Add new assets and generate serials | Director, Admin |
| | `assets:assign` | Assign assets to employees or return to stock | Director, Admin |
| | `assets:delete` | Retire or soft-delete assets | Director, Admin |
| | `assets:export` | Bulk export assets to Excel | Director, Admin, HR |
| **Onboarding** | `onboarding:read` | View new-hire onboarding requests | Director, Admin, HR |
| | `onboarding:create` | Submit onboarding kit requests | Director, HR |
| | `onboarding:fulfill` | Fulfill onboarding hardware items | Director, Admin |
| **Tickets** | `tickets:read` | View ticket queues | Director, Admin, HR, Employee |
| | `tickets:create` | Raise support tickets | Director, Admin, HR, Employee |
| | `tickets:resolve` | Resolve/transfer support tickets | Director, Admin, HR |
| **Settings** | `settings:manage` | Manage company locations & categories | Director, Admin |

### 3.4 Backend Permission Middleware (`validateSession.js`)

```javascript
const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Unauthorized', code: 401 });
    }
    // Director or Super Admin possessing all permissions
    if (req.user.role === 'director' || req.user.permissions?.includes('*')) {
      return next();
    }
    const hasPermission = requiredPermissions.some(perm => req.user.permissions?.includes(perm));
    if (hasPermission) {
      return next();
    }
    return res.status(403).json({ error: true, message: 'Forbidden - Missing required permission', code: 403 });
  };
};
```

### 3.5 Dynamic Frontend Page & Sidebar Construction

In the frontend, `AuthContext` provides a helper hook `hasPermission('assets:create')`:

```javascript
// Sidebar.jsx (Dynamic Navigation Rendering)
const navigationItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
  { name: 'Inventory', path: '/inventory', icon: Package, show: hasPermission('assets:read') },
  { name: 'Tickets', path: '/tickets', icon: Ticket, show: hasPermission('tickets:read') },
  { name: 'Onboarding', path: '/onboarding', icon: UserPlus, show: hasPermission('onboarding:read') },
  { name: 'Scanner', path: '/scanner', icon: QrCode, show: hasPermission('assets:create') },
  { name: 'Employees', path: '/employees', icon: Users, show: hasPermission('employees:read') },
  { name: 'Role Matrix', path: '/settings/roles', icon: Shield, show: hasPermission('roles:manage') },
  { name: 'Settings', path: '/settings', icon: Settings, show: hasPermission('settings:manage') },
];
```

---

## 4. Comparison & Strategic Recommendation

| Metric / Dimension | Option 1: Fixed 4-Tier Hierarchy | Option 2: Dynamic Granular RBAC Matrix |
| :--- | :--- | :--- |
| **Implementation Complexity** | Low (~1–2 days) | Moderate (~3–4 days) |
| **Database Schema Impact** | Minor (Enum update in `employees`) | Moderate (3 new tables: `roles`, `permissions`, `role_permissions`) |
| **Flexibility for Enterprise** | Low (Fixed 4 roles) | High (Unlimited custom roles & tailored access) |
| **Risk of Workflow Breakdown** | 0% (Backward compatible) | 0% (Default system roles preserve existing workflows) |
| **Role Management Scope** | Director only | Director creates & manages custom roles |

### Architectural Recommendation
**Option 2 (Dynamic RBAC)** provides the ultimate long-term flexibility without breaking existing workflows. Default system roles (`admin`, `hr`, `employee`) can be pre-seeded into the database as immutable defaults, ensuring 100% backward compatibility while empowering the **Director** to craft custom roles and granular permission maps effortlessly.
