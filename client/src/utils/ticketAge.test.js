import { describe, it, expect } from 'vitest';
import { getTicketAge, TICKET_AGE_WARNING_DAYS, TICKET_AGE_CRITICAL_DAYS } from './ticketAge';

const NOW = new Date('2026-09-30T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('getTicketAge', () => {
  it('returns null for finished tickets or missing dates', () => {
    expect(getTicketAge({ status: 'resolved', created_at: daysAgo(10) }, NOW)).toBeNull();
    expect(getTicketAge({ status: 'closed', created_at: daysAgo(10) }, NOW)).toBeNull();
    expect(getTicketAge({ status: 'open' }, NOW)).toBeNull();
    expect(getTicketAge({ status: 'open', created_at: 'not a date' }, NOW)).toBeNull();
    expect(getTicketAge(null, NOW)).toBeNull();
  });

  it('labels same-day tickets as under a day old', () => {
    expect(getTicketAge({ status: 'open', created_at: daysAgo(0.2) }, NOW)).toEqual({ days: 0, label: '<1d old', level: 'normal' });
  });

  it('turns amber at the warning threshold and red at the critical one', () => {
    expect(getTicketAge({ status: 'open', created_at: daysAgo(TICKET_AGE_WARNING_DAYS - 1) }, NOW).level).toBe('normal');
    expect(getTicketAge({ status: 'in_progress', created_at: daysAgo(TICKET_AGE_WARNING_DAYS) }, NOW)).toEqual({
      days: TICKET_AGE_WARNING_DAYS, label: `${TICKET_AGE_WARNING_DAYS}d old`, level: 'warning',
    });
    expect(getTicketAge({ status: 'open', created_at: daysAgo(TICKET_AGE_CRITICAL_DAYS - 1) }, NOW).level).toBe('warning');
    expect(getTicketAge({ status: 'open', created_at: daysAgo(TICKET_AGE_CRITICAL_DAYS) }, NOW).level).toBe('critical');
  });

  it('accepts SQL-style timestamps with a space separator', () => {
    expect(getTicketAge({ status: 'open', created_at: '2026-09-25 12:00:00' }, new Date('2026-09-30T13:00:00')).days).toBe(5);
  });
});
