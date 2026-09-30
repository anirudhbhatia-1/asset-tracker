import { describe, expect, it } from 'vitest';
import { canWorkTicket, getTicketStatusOptions } from './ticketStatus';

describe('getTicketStatusOptions', () => {
  it('offers the current status first, then the allowed moves', () => {
    expect(getTicketStatusOptions('open', true)).toEqual(['open', 'in_progress', 'resolved', 'rejected']);
    expect(getTicketStatusOptions('resolved', true)).toEqual(['resolved', 'open', 'in_progress']);
    expect(getTicketStatusOptions('rejected', true)).toEqual(['rejected', 'open']);
  });

  it('drops resolved/rejected without tickets:resolve', () => {
    expect(getTicketStatusOptions('open', false)).toEqual(['open', 'in_progress']);
    expect(getTicketStatusOptions('in_progress', false)).toEqual(['in_progress', 'open']);
  });

  it('offers nothing beyond the current status for closed tickets', () => {
    expect(getTicketStatusOptions('closed', true)).toEqual(['closed']);
  });
});

describe('canWorkTicket', () => {
  const ticket = { id: 1, status: 'open', current_admin_type: 'it' };

  it('lets Directors work any open ticket', () => {
    expect(canWorkTicket({ role: 'director' }, ticket)).toBe(true);
    expect(canWorkTicket({ role: 'admin', isDirector: true, adminType: 'hr' }, ticket)).toBe(true);
  });

  it('limits other admins to their own queue', () => {
    expect(canWorkTicket({ role: 'admin', adminType: 'it' }, ticket)).toBe(true);
    expect(canWorkTicket({ role: 'admin', adminType: 'hr' }, ticket)).toBe(false);
    expect(canWorkTicket({ role: 'admin', adminType: null }, ticket)).toBe(false);
  });

  it('never allows working a closed ticket', () => {
    expect(canWorkTicket({ role: 'director' }, { ...ticket, status: 'closed' })).toBe(false);
  });
});
