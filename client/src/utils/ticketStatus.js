// Ticket workflow rules, mirrored from the server (ticketService.js
// ALLOWED_STATUS_CHANGES) so the details modal only offers moves the API
// will accept. Closing/reopening a resolved ticket is the owner's
// confirm-close/reopen flow, not an admin status change.

export const TICKET_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
  closed: 'Closed',
};

export const ALLOWED_TICKET_STATUS_CHANGES = {
  open: ['in_progress', 'resolved', 'rejected'],
  in_progress: ['open', 'resolved', 'rejected'],
  resolved: ['open', 'in_progress'],
  rejected: ['open'],
  closed: [],
};

// Statuses that close a ticket out and need tickets:resolve.
const RESOLVE_STATUSES = ['resolved', 'rejected'];

/**
 * Statuses to offer in the admin status picker: the current one first, then
 * every allowed next status. Resolved/Rejected are dropped without
 * tickets:resolve.
 */
export const getTicketStatusOptions = (currentStatus, canResolve) => {
  const next = (ALLOWED_TICKET_STATUS_CHANGES[currentStatus] || [])
    .filter(status => canResolve || !RESOLVE_STATUSES.includes(status));
  return currentStatus ? [currentStatus, ...next] : next;
};

const isDirectorUser = (user) => Boolean(user && (user.role === 'director' || user.isDirector));

/**
 * Whether `ticket` is in `user`'s hands: Directors work any ticket, other
 * admins only tickets currently in their own queue. Closed tickets are final.
 * Callers still check tickets:update / tickets:resolve for the action itself.
 */
export const canWorkTicket = (user, ticket) => {
  if (!user || !ticket || ticket.status === 'closed') return false;
  if (isDirectorUser(user)) return true;
  return Boolean(user.adminType) && user.adminType === ticket.current_admin_type;
};
