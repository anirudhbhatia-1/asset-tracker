// Automatic escalation of High/Urgent tickets that nobody picks up.
//
// A ticket counts as "not picked up" while it is still 'open' (moving it to
// In progress stops the clock). The clock is `queue_entered_at`: when the
// ticket arrived in its current queue (reset on every transfer and reopen).
// It runs 24/7.
//
//   IT Admin / Admin queue, 10 min untouched  -> moved once to the other one
//   ...still untouched 10 min after the move  -> Directors alerted
//   HR Admin queue, 10 min untouched          -> the employee is told to
//                                               contact management
//
// Each step happens once per ticket. A person moving a ticket between IT Admin
// and Admin counts as the move, so the next step is the Directors, not a move
// back. Times come from the database clock. The check runs every minute and is
// safe to run from several servers at once (rows are claimed with SKIP LOCKED).
const { pool, withTransaction } = require('../db');
const logger = require('../logger');

const ESCALATE_AFTER_MINUTES = 10;
const URGENT_PRIORITIES = ['high', 'urgent'];
const OTHER_ADMIN_QUEUE = { it: 'hardware', hardware: 'it' };
const QUEUE_NAMES = { it: 'IT Admin', hardware: 'Admin', hr: 'HR Admin' };
const CHECK_EVERY_MS = 60 * 1000;

// Tickets due for their next step, locked for this run.
const claimDue = (client) => client.query(`
  SELECT id, title, current_admin_type, escalation_stage, priority, employee_id
  FROM tickets
  WHERE status = 'open'
    AND priority = ANY($1::text[])
    AND queue_entered_at <= NOW() - make_interval(mins => $2)
    AND (
      (current_admin_type IN ('it', 'hardware') AND (escalation_stage IS NULL OR escalation_stage = 'moved'))
      OR (current_admin_type = 'hr' AND escalation_stage IS NULL)
    )
  ORDER BY id
  LIMIT 100
  FOR UPDATE SKIP LOCKED`, [URGENT_PRIORITIES, ESCALATE_AFTER_MINUTES]);

const moveToOtherQueue = async (client, ticket) => {
  const target = OTHER_ADMIN_QUEUE[ticket.current_admin_type];
  await client.query(`
    UPDATE tickets
    SET current_admin_type = $2, escalation_stage = 'moved', escalated_at = NOW(),
        queue_entered_at = NOW(), updated_at = NOW()
    WHERE id = $1`, [ticket.id, target]);
  await client.query(`
    INSERT INTO ticket_history (ticket_id, event_type, performed_by, from_admin_type, to_admin_type, note)
    VALUES ($1, 'transferred', NULL, $2, $3, $4)`,
  [ticket.id, ticket.current_admin_type, target,
    `Moved automatically: ${ticket.priority} priority ticket not picked up by ${QUEUE_NAMES[ticket.current_admin_type]} within ${ESCALATE_AFTER_MINUTES} minutes`]);
  return { id: ticket.id, action: 'moved', to: target };
};

const alertDirectors = async (client, ticket) => {
  await client.query(`
    UPDATE tickets SET escalation_stage = 'directors_alerted', escalated_at = NOW(), updated_at = NOW()
    WHERE id = $1`, [ticket.id]);
  await client.query(`
    INSERT INTO ticket_history (ticket_id, event_type, performed_by, note)
    VALUES ($1, 'escalated', NULL, $2)`,
  [ticket.id, `Directors alerted: still not picked up ${ESCALATE_AFTER_MINUTES} minutes after it was moved to ${QUEUE_NAMES[ticket.current_admin_type]}`]);
  return { id: ticket.id, action: 'directors_alerted' };
};

const notifyEmployee = async (client, ticket) => {
  await client.query(`
    UPDATE tickets SET escalation_stage = 'employee_notified', escalated_at = NOW(), updated_at = NOW()
    WHERE id = $1`, [ticket.id]);
  await client.query(`
    INSERT INTO ticket_history (ticket_id, event_type, performed_by, note)
    VALUES ($1, 'escalated', NULL, $2)`,
  [ticket.id, `HR Admin did not pick this up within ${ESCALATE_AFTER_MINUTES} minutes; the employee was told to contact management`]);
  return { id: ticket.id, action: 'employee_notified' };
};

const escalate = (client, ticket) => {
  if (ticket.current_admin_type === 'hr') return notifyEmployee(client, ticket);
  if (!ticket.escalation_stage) return moveToOtherQueue(client, ticket);
  return alertDirectors(client, ticket);
};

/**
 * One pass: escalates every ticket that is due. Returns what was done. Each
 * ticket has its own savepoint, so one that fails is skipped (and retried next
 * minute) without undoing or blocking the others.
 */
const runEscalations = async () => withTransaction(async (client) => {
  const { rows } = await claimDue(client);
  const done = [];
  for (const ticket of rows) {
    await client.query('SAVEPOINT escalate_one');
    try {
      done.push(await escalate(client, ticket));
      await client.query('RELEASE SAVEPOINT escalate_one');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT escalate_one');
      logger.error({ err: err.message, ticketId: ticket.id }, 'Could not escalate ticket');
    }
  }
  return done;
});

let timer = null;
const startEscalationWorker = () => {
  if (timer) return;
  const tick = () => runEscalations()
    .then((done) => { if (done.length) logger.info({ escalations: done }, 'Escalated unattended urgent tickets'); })
    .catch((err) => logger.error({ err: err.message }, 'Ticket escalation check failed'));
  timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref();
  tick();
};

module.exports = { runEscalations, startEscalationWorker, ESCALATE_AFTER_MINUTES, URGENT_PRIORITIES };
