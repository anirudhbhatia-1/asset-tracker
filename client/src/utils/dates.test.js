import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDaysLocalISO, parseDateValue, toDateInputValue, toLocalISODate, todayLocalISO } from './dates';

afterEach(() => vi.useRealTimers());

describe('local calendar dates', () => {
  it('formats the local calendar day', () => {
    expect(toLocalISODate(new Date(2026, 9, 1, 2, 0))).toBe('2026-10-01');
  });

  it('uses the local day for today and offsets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 1, 1, 30));
    expect(todayLocalISO()).toBe('2026-10-01');
    expect(addDaysLocalISO(1)).toBe('2026-10-02');
  });

  it('prepares server dates for date inputs', () => {
    expect(toDateInputValue('2029-06-14')).toBe('2029-06-14');
    expect(toDateInputValue('2029-06-14T00:00:00.000Z')).toBe('2029-06-14');
    expect(toDateInputValue(null)).toBe('');
  });
});

describe('parseDateValue', () => {
  it('reads date-only strings as local calendar dates', () => {
    const d = parseDateValue('2026-07-22');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 6, 22, 0]);
  });

  it('parses timestamps and rejects junk', () => {
    expect(parseDateValue('2026-07-22 14:30:00').getHours()).toBe(14);
    expect(Number.isNaN(parseDateValue('nope').getTime())).toBe(true);
    expect(Number.isNaN(parseDateValue(null).getTime())).toBe(true);
  });
});
