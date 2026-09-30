// Age indicator for tickets still waiting on someone. A ticket turns amber
// once it has been open this many days, and red at the critical threshold.
export const TICKET_AGE_WARNING_DAYS = 3;
export const TICKET_AGE_CRITICAL_DAYS = 7;

const ACTIVE_STATUSES = ['open', 'in_progress'];
const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Returns { days, label, level } for open/in-progress tickets, or null when the
 * ticket is finished or has no usable created_at. level is 'normal',
 * 'warning' or 'critical'.
 */
export function getTicketAge(ticket, now = new Date()) {
  if (!ticket || !ACTIVE_STATUSES.includes(ticket.status) || !ticket.created_at) return null;

  const raw = ticket.created_at;
  const created = raw instanceof Date ? raw : new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(created.getTime())) return null;

  const days = Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY_MS));
  let level = 'normal';
  if (days >= TICKET_AGE_CRITICAL_DAYS) level = 'critical';
  else if (days >= TICKET_AGE_WARNING_DAYS) level = 'warning';

  return { days, label: days === 0 ? '<1d old' : `${days}d old`, level };
}
