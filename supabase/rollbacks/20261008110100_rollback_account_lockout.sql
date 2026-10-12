-- Rollback for 20261008110100_account_lockout.sql. Roll the code back first
-- (it reads these columns on every sign-in). Run by hand after a backup;
-- afterwards delete this migration's row from app_migrations.
BEGIN;
ALTER TABLE employees DROP COLUMN IF EXISTS locked_until;
ALTER TABLE employees DROP COLUMN IF EXISTS failed_login_count;
COMMIT;
