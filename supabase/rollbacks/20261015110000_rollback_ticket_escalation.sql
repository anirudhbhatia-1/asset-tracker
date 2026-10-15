-- Rollback for 20261015110000_ticket_escalation.sql. Roll the code back
-- first. Run by hand after a backup; afterwards delete this migration's row
-- from app_migrations.
BEGIN;
DROP INDEX IF EXISTS tickets_open_priority_idx;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_escalation_stage_check;
ALTER TABLE tickets DROP COLUMN IF EXISTS escalated_at;
ALTER TABLE tickets DROP COLUMN IF EXISTS escalation_stage;
ALTER TABLE tickets DROP COLUMN IF EXISTS queue_entered_at;
COMMIT;
