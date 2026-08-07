-- Migration: Dynamic RBAC Schema with Director Role, Permissions Catalog, and Rollback Safety
-- Date: 2026-08-06

BEGIN;

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_director BOOLEAN DEFAULT false,
  admin_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Permissions Catalog Table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Role Permissions Join Table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Create Indexes on role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- 5. Seed Core System Roles
INSERT INTO roles (id, name, description, is_system, is_director, admin_type) VALUES
(1, 'Director', 'Full unrestricted access across all modules', true, true, NULL),
(2, 'Admin', 'IT Infrastructure and Asset Administrator', true, false, 'it'),
(3, 'HR', 'Human Resources Administrator', true, false, 'hr'),
(4, 'Employee', 'Standard Organization Employee', true, false, NULL)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system,
  is_director = EXCLUDED.is_director,
  admin_type = EXCLUDED.admin_type;

SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- 6. Add role_id to employees table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'role_id'
    ) THEN
        ALTER TABLE employees ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 7. Widen employees_role_check constraint idempotently
DO $$
DECLARE
    emp_cons_name TEXT;
BEGIN
    SELECT conname INTO emp_cons_name 
    FROM pg_constraint 
    WHERE conrelid = 'employees'::regclass AND conname LIKE '%role%';
    IF emp_cons_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE employees DROP CONSTRAINT ' || emp_cons_name;
    END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role IN ('director', 'admin', 'hr', 'employee'));

-- 8. Backfill role_id for existing employees based on current role string
UPDATE employees SET role_id = 1 WHERE role = 'director';
UPDATE employees SET role_id = 2 WHERE role = 'admin';
UPDATE employees SET role_id = 3 WHERE role = 'hr';
UPDATE employees SET role_id = 4 WHERE role_id IS NULL OR role = 'employee';

-- 9. Promote admin@company.com to Director (Decision #3)
UPDATE employees 
SET role = 'director', role_id = 1 
WHERE email = 'admin@company.com';

-- 10. Seed Fine-Grained Permissions Catalog
INSERT INTO permissions (key, module, description) VALUES
-- Inventory Module
('inventory:read', 'inventory', 'View asset list and details'),
('inventory:create', 'inventory', 'Add new assets'),
('inventory:update', 'inventory', 'Edit asset metadata'),
('inventory:delete', 'inventory', 'Decommission or delete assets'),
('inventory:export', 'inventory', 'Export asset data to Excel'),
('inventory:import', 'inventory', 'Bulk import assets from Excel'),
('inventory:assign', 'inventory', 'Assign assets to employees'),
-- Employees Module
('employees:read', 'employees', 'View employee directory'),
('employees:create', 'employees', 'Create employee profiles'),
('employees:update', 'employees', 'Edit employee profiles'),
('employees:delete', 'employees', 'Soft delete employee profiles'),
('employees:grant-access', 'employees', 'Grant login access and update roles'),
('employees:assign-assets', 'employees', 'Bulk assign assets to employees'),
-- Tickets Module
('tickets:read', 'tickets', 'View support tickets'),
('tickets:create', 'tickets', 'Create support tickets'),
('tickets:update', 'tickets', 'Update ticket details'),
('tickets:resolve', 'tickets', 'Resolve and confirm support tickets'),
('tickets:delete', 'tickets', 'Delete support tickets'),
-- Onboarding Module
('onboarding:read', 'onboarding', 'View onboarding requests'),
('onboarding:create', 'onboarding', 'Create onboarding requests'),
('onboarding:update', 'onboarding', 'Update onboarding requests'),
('onboarding:fulfill', 'onboarding', 'Fulfill requested onboarding items'),
('onboarding:delete', 'onboarding', 'Delete onboarding requests'),
-- Scanner Module
('scanner:read', 'scanner', 'Access QR barcode scanner'),
-- Settings Module
('settings:read', 'settings', 'View application settings'),
('settings:manage', 'settings', 'Modify system settings'),
-- History Module (Risk Audit #18)
('history:read', 'history', 'View audit log history'),
-- Roles Module
('roles:read', 'roles', 'View custom roles'),
('roles:manage', 'roles', 'Create, update, and delete custom roles')
ON CONFLICT (key) DO NOTHING;

-- 11. Seed Default Role Permissions
-- Admin Permissions (All permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions
ON CONFLICT DO NOTHING;

-- HR Permissions (Excluded: inventory:read, inventory:export per Decision #1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions 
WHERE key IN (
  'employees:read', 'employees:create', 'employees:update', 'employees:delete', 'employees:grant-access', 'employees:assign-assets',
  'tickets:read', 'tickets:create', 'tickets:update', 'tickets:resolve',
  'onboarding:read', 'onboarding:create', 'onboarding:update', 'onboarding:fulfill', 'onboarding:delete',
  'history:read'
)
ON CONFLICT DO NOTHING;

-- Employee Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions 
WHERE key IN ('tickets:read', 'tickets:create')
ON CONFLICT DO NOTHING;

COMMIT;
