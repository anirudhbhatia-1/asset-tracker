import { describe, expect, it } from 'vitest';
import { filterTickets, readTicketQuery, sortTickets, ticketsLink } from './ticketQueue';

const tickets = [
  { id: 1, title: 'Printer jam', status: 'open', priority: 'low', created_at: '2026-10-01T10:00:00Z', employee_name: 'Asha' },
  { id: 2, title: 'Laptop dead', status: 'in_progress', priority: 'urgent', created_at: '2026-10-03T10:00:00Z', employee_name: 'Ravi' },
  { id: 3, title: 'Need monitor', status: 'closed', priority: 'urgent', created_at: '2026-10-02T10:00:00Z', employee_name: 'Asha' },
  { id: 4, title: 'VPN', status: 'open', priority: 'high', created_at: '2026-10-04T10:00:00Z', employee_name: 'Meera' },
];

describe('ticket queue', () => {
  it('reads settings from the URL with role-based defaults', () => {
    expect(readTicketQuery(new URLSearchParams(''), { worksTickets: true })).toMatchObject({ status: 'active', sort: 'priority', view: 'my_queue' });
    expect(readTicketQuery(new URLSearchParams(''))).toMatchObject({ status: 'all', sort: 'newest' });
    expect(readTicketQuery(new URLSearchParams('status=bogus&priority=urgent&view=all&q=vpn'))).toMatchObject({ status: 'all', priority: 'urgent', view: 'all', q: 'vpn' });
  });

  it('filters by status, priority and text (title, person, reference)', () => {
    expect(filterTickets(tickets, { status: 'active' }).map((t) => t.id)).toEqual([1, 2, 4]);
    expect(filterTickets(tickets, { status: 'done' }).map((t) => t.id)).toEqual([3]);
    expect(filterTickets(tickets, { priority: 'urgent_high' }).map((t) => t.id)).toEqual([2, 3, 4]);
    expect(filterTickets(tickets, { q: 'asha' }).map((t) => t.id)).toEqual([1, 3]);
    expect(filterTickets(tickets, { q: 'tk-0004' }).map((t) => t.id)).toEqual([4]);
    expect(filterTickets([{ id: 9, current_admin_type: 'hr' }, { id: 8, current_admin_type: 'it' }], { queue: 'hr' }).map((t) => t.id)).toEqual([9]);
  });

  it('sorts most urgent first, unfinished before done, oldest first within a priority', () => {
    expect(sortTickets(tickets, 'priority').map((t) => t.id)).toEqual([2, 4, 1, 3]);
    expect(sortTickets(tickets, 'newest').map((t) => t.id)).toEqual([4, 2, 3, 1]);
    expect(sortTickets(tickets, 'oldest').map((t) => t.id)).toEqual([1, 3, 2, 4]);
  });

  it('builds links that open a filtered list', () => {
    expect(ticketsLink({ view: 'all', priority: 'urgent_high', q: '' })).toBe('/tickets?view=all&priority=urgent_high');
    expect(ticketsLink()).toBe('/tickets');
  });
});
