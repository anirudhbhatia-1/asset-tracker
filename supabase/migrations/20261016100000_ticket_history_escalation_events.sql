-- Ticket history: automatic escalations and priority changes get their own
-- event types instead of showing up as "status changed". Existing rows
-- written by the first version are relabelled.
ALTER TABLE ticket_history DROP CONSTRAINT IF EXISTS ticket_history_event_type_check;

UPDATE ticket_history SET event_type = 'priority_changed'
WHERE event_type = 'status_changed' AND note LIKE 'Priority changed from %';
UPDATE ticket_history SET event_type = 'escalated'
WHERE event_type = 'status_changed' AND performed_by IS NULL
  AND (note LIKE 'Directors alerted:%' OR note LIKE 'HR Admin did not pick this up%');

ALTER TABLE ticket_history ADD CONSTRAINT ticket_history_event_type_check CHECK (event_type IN (
  'created', 'transferred', 'status_changed', 'resolved', 'rejected', 'closed', 'reopened',
  'priority_changed', 'escalated'
));
