// Shared ticket labels, so every screen names queues and priorities the same.
// The `hardware` queue key stays as stored; only its label is "Admin".

export const QUEUE_LABELS = { it: 'IT Admin', hardware: 'Admin', hr: 'HR Admin' };
export const QUEUE_SHORT_LABELS = { it: 'IT', hardware: 'Admin', hr: 'HR' };
export const queueLabel = (key, { short = false } = {}) => (
  (short ? QUEUE_SHORT_LABELS : QUEUE_LABELS)[key] || key || ''
);

// One line per queue, shown when raising a ticket.
export const QUEUE_HINTS = {
  it: 'Laptop, software, email, accounts or network problems.',
  hardware: 'New equipment and accessories, desk and office needs.',
  hr: 'Anything for HR.',
};
// Where a new ticket goes unless the person picks a department.
export const defaultQueueFor = (type) => (type === 'request' ? 'hardware' : 'it');

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
export const DEFAULT_PRIORITY = 'medium';

// Pill tones (components/ui/Pill). Red is kept for Urgent so it means "now".
const PRIORITY_TONES = { low: 'neutral', medium: 'neutral', high: 'warning', urgent: 'danger' };
export const priorityLabel = (value) => PRIORITIES.find((p) => p.value === value)?.label || 'Medium';
export const priorityTone = (value) => (Object.hasOwn(PRIORITY_TONES, value) ? PRIORITY_TONES[value] : 'neutral');
// Urgent first, then High…; for sorting the queue.
export const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

// Open is blue (new, waiting), not red: red stays for urgent and overdue.
const STATUS_TONES = { open: 'info', in_progress: 'purple', resolved: 'success', closed: 'neutral', rejected: 'neutral' };
export const ticketStatusTone = (status) => STATUS_TONES[status] || 'neutral';

/** The reference people quote: "TK-0606". */
export const ticketRef = (ticket) => {
  if (!ticket) return '';
  if (ticket.human_readable_id) return ticket.human_readable_id;
  return ticket.id != null ? `TK-${String(ticket.id).padStart(4, '0')}` : '';
};

export const TICKET_TYPE_LABELS = { issue: 'Issue', request: 'Request' };

/**
 * "What do you need?" accepts a category or free text. A text that matches a
 * category name (ignoring case and spaces) links to that category; anything
 * else is sent as the typed-in item.
 */
export const resolveRequestedItem = (text, categories = []) => {
  const typed = String(text || '').trim().slice(0, 100);
  if (!typed) return { categoryId: undefined, requestedItem: undefined };
  const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const match = categories.find((c) => norm(c.name) === norm(typed));
  return match ? { categoryId: Number(match.id), requestedItem: undefined } : { categoryId: undefined, requestedItem: typed };
};

/** What a request ticket asks for: the category name, or the typed-in item. */
export const requestedThing = (ticket) => ticket?.category_name || ticket?.requested_item || null;

// Timeline heading for a ticket_history row. performed_by is empty for the
// automatic escalation steps.
const EVENT_LABELS = {
  created: 'Created',
  transferred: 'Transferred',
  status_changed: 'Status changed',
  resolved: 'Resolved',
  rejected: 'Rejected',
  closed: 'Closed',
  reopened: 'Reopened',
  priority_changed: 'Priority changed',
  escalated: 'Escalated',
};
export const historyEventLabel = (event) => {
  if (event?.event_type === 'transferred' && !event.performed_by) return 'Moved automatically';
  return EVENT_LABELS[event?.event_type] || String(event?.event_type || '').replace(/_/g, ' ');
};
export const historyEventActor = (event) => event?.performed_by_name || (event?.performed_by ? 'Former user' : 'Automatic');
