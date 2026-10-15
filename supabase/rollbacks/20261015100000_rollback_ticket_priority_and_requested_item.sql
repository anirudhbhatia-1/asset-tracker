-- Rollback for 20261015100000_ticket_priority_and_requested_item.sql. Loses
-- ticket priorities and typed-in requested items. Roll the code back first.
-- Run by hand after a backup; afterwards delete this migration's row from
-- app_migrations.
BEGIN;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_requested_item_length;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priority_check;
ALTER TABLE tickets DROP COLUMN IF EXISTS requested_item;
ALTER TABLE tickets DROP COLUMN IF EXISTS priority;
COMMIT;
