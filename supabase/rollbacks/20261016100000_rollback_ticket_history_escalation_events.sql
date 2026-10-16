-- Rollback for 20261016100000_ticket_history_escalation_events.sql. Roll the
-- code back first. Run by hand after a backup; afterwards delete this
-- migration's row from app_migrations.
BEGIN;
ALTER TABLE ticket_history DROP CONSTRAINT IF EXISTS ticket_history_event_type_check;
UPDATE ticket_history SET event_type = 'status_changed' WHERE event_type IN ('priority_changed', 'escalated');
ALTER TABLE ticket_history ADD CONSTRAINT ticket_history_event_type_check CHECK (event_type IN (
  'created', 'transferred', 'status_changed', 'resolved', 'rejected', 'closed', 'reopened'
));
COMMIT;
