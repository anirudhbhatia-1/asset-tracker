// Shared ticket labels, so every screen names queues and priorities the same.
// The `hardware` queue key stays as stored; only its label is "Admin".

export const QUEUE_LABELS = { it: 'IT Admin', hardware: 'Admin', hr: 'HR Admin' };
export const QUEUE_SHORT_LABELS = { it: 'IT', hardware: 'Admin', hr: 'HR' };
export const queueLabel = (key, { short = false } = {}) => (
  (short ? QUEUE_SHORT_LABELS : QUEUE_LABELS)[key] || key || ''
);

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
export const DEFAULT_PRIORITY = 'medium';

const PRIORITY_STYLES = {
  low: 'bg-raised text-secondary border-border',
  medium: 'bg-accent/10 text-accent border-accent/20',
  high: 'bg-warning/10 text-warning border-warning/30',
  urgent: 'bg-error/10 text-error border-error/30',
};
export const priorityLabel = (value) => PRIORITIES.find((p) => p.value === value)?.label || 'Medium';
export const priorityStyle = (value) => (
  Object.hasOwn(PRIORITY_STYLES, value) ? PRIORITY_STYLES[value] : PRIORITY_STYLES.medium
);

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
