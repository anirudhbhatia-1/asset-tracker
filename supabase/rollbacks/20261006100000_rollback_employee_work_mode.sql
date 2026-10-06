-- Rollback for 20261006100000_employee_work_mode.sql. Loses every employee's
-- work mode: take a backup first. Run by hand; never applied by
-- scripts/migrate.js. Afterwards delete the row for this migration from
-- app_migrations.
BEGIN;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_work_mode_check;
ALTER TABLE employees DROP COLUMN IF EXISTS work_mode;
COMMIT;
