// Filtering and sorting for the Tickets page. The settings live in the URL
// (?status=&view=&priority=&q=&sort=) so dashboard numbers can link straight
// to the matching list, and a reload or shared link keeps the view.
import { PRIORITY_RANK, ticketRef } from './ticketMeta';

export const STATUS_FILTERS = [
  { value: 'active', label: 'Open & In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];
export const PRIORITY_FILTERS = [
  { value: 'all', label: 'Any Priority' },
  { value: 'urgent_high', label: 'Urgent & High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
export const SORTS = [
  { value: 'priority', label: 'Most Urgent First' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
];
export const VIEWS = ['my_queue', 'all', 'my_tickets'];
export const QUEUES = ['it', 'hardware', 'hr'];

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Reads the settings from URL params, falling back to sensible defaults. */
export const readTicketQuery = (params, { worksTickets = false } = {}) => ({
  status: pick(params.get('status'), STATUS_FILTERS.map((f) => f.value), worksTickets ? 'active' : 'all'),
  priority: pick(params.get('priority'), PRIORITY_FILTERS.map((f) => f.value), 'all'),
  sort: pick(params.get('sort'), SORTS.map((s) => s.value), worksTickets ? 'priority' : 'newest'),
  view: pick(params.get('view'), VIEWS, 'my_queue'),
  // Only one team's tickets (Director overview links), or '' for any.
  queue: pick(params.get('queue'), QUEUES, ''),
  q: (params.get('q') || '').slice(0, 100),
});

const DONE = ['resolved', 'closed', 'rejected'];
const createdTime = (ticket) => {
  const time = new Date(String(ticket.created_at || '').replace(' ', 'T')).getTime();
  return Number.isNaN(time) ? 0 : time;
};
const normalise = (value) => String(value || '').toLowerCase();

export const filterTickets = (tickets, { status = 'all', priority = 'all', q = '', queue = '' } = {}) => {
  const needle = normalise(q).trim();
  return tickets.filter((ticket) => {
    if (queue && ticket.current_admin_type !== queue) return false;
    if (status === 'active' && DONE.includes(ticket.status)) return false;
    if (status === 'done' && !DONE.includes(ticket.status)) return false;
    if (priority === 'urgent_high' && !['urgent', 'high'].includes(ticket.priority)) return false;
    if (!['all', 'urgent_high'].includes(priority) && (ticket.priority || 'medium') !== priority) return false;
    if (!needle) return true;
    return [ticketRef(ticket), ticket.id, ticket.title, ticket.description, ticket.employee_name, ticket.asset_name, ticket.requested_item, ticket.category_name]
      .some((field) => normalise(field).includes(needle));
  });
};

export const sortTickets = (tickets, sort = 'newest') => {
  const list = [...tickets];
  if (sort === 'oldest') return list.sort((a, b) => createdTime(a) - createdTime(b) || a.id - b.id);
  if (sort === 'priority') {
    // Unfinished first, then urgent → low, then the longest-waiting first.
    return list.sort((a, b) => (DONE.includes(a.status) - DONE.includes(b.status))
      || ((PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2))
      || (createdTime(a) - createdTime(b)));
  }
  return list.sort((a, b) => createdTime(b) - createdTime(a) || b.id - a.id);
};

/** A Tickets page link with the given settings, e.g. ticketsLink({ view: 'all', priority: 'urgent_high' }). */
export const ticketsLink = (settings = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const query = params.toString();
  return query ? `/tickets?${query}` : '/tickets';
};
