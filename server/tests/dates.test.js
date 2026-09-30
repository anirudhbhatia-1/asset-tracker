import { describe, expect, it } from 'vitest';
import { types } from 'pg';

import '../db';
import { todayISO } from '../utils/dates';

describe('calendar dates', () => {
  it('returns DATE columns exactly as stored, whatever the server timezone', () => {
    const parse = types.getTypeParser(1082);
    expect(parse('2029-06-14')).toBe('2029-06-14');
    // Round trip through JSON (what the edit form sends back) keeps the day.
    expect(JSON.parse(JSON.stringify({ d: parse('2029-06-14') })).d).toBe('2029-06-14');
  });

  it("uses India's calendar day for 'today', not UTC", () => {
    // 2026-10-01 02:00 IST is still 2026-09-30 in UTC.
    const earlyMorningIST = new Date('2026-09-30T20:30:00Z');
    expect(todayISO(earlyMorningIST)).toBe('2026-10-01');
    expect(earlyMorningIST.toISOString().substring(0, 10)).toBe('2026-09-30');
  });
});
