-- Rollback for 20261008110000_access_audit.sql. DESTROYS the access history:
-- take a backup first. Run by hand; never applied by scripts/migrate.js.
-- The code that writes access history must be rolled back first, or role and
-- access changes will fail. Afterwards delete this migration's row from
-- app_migrations.
BEGIN;
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE key = 'audit:read');
DELETE FROM permissions WHERE key = 'audit:read';
DROP TABLE IF EXISTS access_audit;
COMMIT;
