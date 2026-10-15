-- Automatic escalation of High/Urgent tickets nobody has picked up:
--   queue_entered_at  when the ticket arrived in its current queue (the
--                     10-minute clock); reset on every transfer and reopen.
--   escalation_stage  how far it has been escalated:
--                     'moved'             moved once IT Admin <-> Admin
--                     'directors_alerted' the second queue didn't pick it up either
--                     'employee_notified' HR didn't pick it up; the employee was
--                                         told to contact management
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_stage VARCHAR(20);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

UPDATE tickets t
SET queue_entered_at = COALESCE(
  (SELECT MAX(h.created_at) FROM ticket_history h WHERE h.ticket_id = t.id AND h.event_type = 'transferred'),
  t.created_at, NOW())
WHERE queue_entered_at IS NULL;

ALTER TABLE tickets ALTER COLUMN queue_entered_at SET DEFAULT NOW();
ALTER TABLE tickets ALTER COLUMN queue_entered_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_escalation_stage_check') THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_escalation_stage_check
      CHECK (escalation_stage IS NULL OR escalation_stage IN ('moved', 'directors_alerted', 'employee_notified'));
  END IF;
END $$;

-- The escalation check runs every minute over open high/urgent tickets.
CREATE INDEX IF NOT EXISTS tickets_open_priority_idx
  ON tickets (queue_entered_at) WHERE status = 'open' AND priority IN ('high', 'urgent');
