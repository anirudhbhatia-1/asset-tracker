-- Rollback for 20261008110200_performance_indexes.sql (indexes only; no data
-- is lost). Run by hand; afterwards delete this migration's row from app_migrations.
DROP INDEX IF EXISTS sessions_expires_at_idx;
DROP INDEX IF EXISTS sessions_employee_id_idx;
DROP INDEX IF EXISTS employees_role_id_idx;
DROP INDEX IF EXISTS tickets_created_at_idx;
DROP INDEX IF EXISTS tickets_admin_type_status_idx;
DROP INDEX IF EXISTS asset_history_asset_event_at_idx;
DROP INDEX IF EXISTS offboarding_requests_employee_id_idx;
