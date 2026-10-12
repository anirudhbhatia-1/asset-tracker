-- Rollback for 20261008120000_login_failure_window.sql. Run by hand after a
-- backup; never applied by scripts/migrate.js. Afterwards delete this
-- migration's row from app_migrations.
BEGIN;
ALTER TABLE employees DROP COLUMN IF EXISTS last_failed_login_at;
COMMIT;
