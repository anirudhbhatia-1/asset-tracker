-- 1. Drop old constraints and add new ones to allow 'closed' status and 'closed'/'reopened' events
DO $$
DECLARE
    status_cons_name TEXT;
    event_cons_name TEXT;
BEGIN
    SELECT conname INTO status_cons_name FROM pg_constraint WHERE conrelid = 'tickets'::regclass AND conname LIKE '%status%';
    IF status_cons_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tickets DROP CONSTRAINT ' || status_cons_name;
    END IF;

    SELECT conname INTO event_cons_name FROM pg_constraint WHERE conrelid = 'ticket_history'::regclass AND conname LIKE '%event_type%';
    IF event_cons_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE ticket_history DROP CONSTRAINT ' || event_cons_name;
    END IF;
END $$;

ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('open','in_progress','resolved','rejected','closed'));
ALTER TABLE ticket_history ADD CONSTRAINT ticket_history_event_type_check CHECK (event_type IN ('created','transferred','status_changed','resolved','rejected','closed','reopened'));
