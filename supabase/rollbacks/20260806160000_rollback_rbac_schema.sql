-- Rollback Migration: Revert RBAC Schema and Restore Single-String Roles
-- Date: 2026-08-06

BEGIN;

-- 1. Revert any Director role to Admin in employees
UPDATE employees SET role = 'admin' WHERE role = 'director';

-- 2. Drop constraint on employees role
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

ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role IN ('admin', 'hr', 'employee'));

-- 3. Drop role_id column from employees if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'role_id'
    ) THEN
        ALTER TABLE employees DROP COLUMN role_id;
    END IF;
END $$;

-- 4. Drop RBAC Tables and Indexes
DROP INDEX IF EXISTS idx_role_permissions_role_id;
DROP INDEX IF EXISTS idx_role_permissions_permission_id;

DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

COMMIT;
