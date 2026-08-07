-- Migration: 20260807000000_align_permission_catalog.sql
-- Aligns permission catalog keys with OPTION_2_WORKFLOW_SPEC.md §3 catalog.

BEGIN;

-- 1. Rename inventory:* permission keys to assets:* in place
UPDATE permissions SET key = 'assets:read'   WHERE key = 'inventory:read';
UPDATE permissions SET key = 'assets:create' WHERE key = 'inventory:create';
UPDATE permissions SET key = 'assets:update' WHERE key = 'inventory:update';
UPDATE permissions SET key = 'assets:delete' WHERE key = 'inventory:delete';
UPDATE permissions SET key = 'assets:export' WHERE key = 'inventory:export';
UPDATE permissions SET key = 'assets:import' WHERE key = 'inventory:import';
UPDATE permissions SET key = 'assets:assign' WHERE key = 'inventory:assign';

-- 2. Update module column for renamed assets keys
UPDATE permissions SET module = 'assets' WHERE key LIKE 'assets:%';

-- 3. Standardize employees:update to employees:manage
UPDATE permissions SET key = 'employees:manage' WHERE key = 'employees:update';

-- 4. Insert missing permission keys if not present
INSERT INTO permissions (key, module, description) VALUES
  ('categories:read',   'categories', 'View category schema & populate form dropdowns'),
  ('categories:manage', 'categories', 'Create, edit, or delete hardware categories'),
  ('locations:read',    'locations',  'View office locations & addresses'),
  ('locations:manage',  'locations',  'Create/edit company office locations')
ON CONFLICT (key) DO NOTHING;

-- 5. Grant categories:read to all default roles (Director=1, Admin=2, HR=3, Employee=4)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.key = 'categories:read' AND r.id IN (1, 2, 3, 4)
ON CONFLICT DO NOTHING;

-- 6. Grant categories:manage to Director and Admin (roles 1, 2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.key = 'categories:manage' AND r.id IN (1, 2)
ON CONFLICT DO NOTHING;

-- 7. Grant locations:read to all default roles (roles 1, 2, 3, 4)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.key = 'locations:read' AND r.id IN (1, 2, 3, 4)
ON CONFLICT DO NOTHING;

-- 8. Grant locations:manage to Director and Admin (roles 1, 2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.key = 'locations:manage' AND r.id IN (1, 2)
ON CONFLICT DO NOTHING;

COMMIT;
