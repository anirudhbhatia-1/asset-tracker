import { describe, expect, it } from 'vitest';
import { isSignInLocked, lockMinutesLeft } from './lockout';

const now = Date.parse('2026-10-08T10:00:00Z');

describe('isSignInLocked', () => {
  it('is locked only while lockedUntil is in the future', () => {
    expect(isSignInLocked({ lockedUntil: '2026-10-08T10:15:00Z' }, now)).toBe(true);
    expect(isSignInLocked({ lockedUntil: '2026-10-08T09:59:00Z' }, now)).toBe(false);
    expect(isSignInLocked({ lockedUntil: null }, now)).toBe(false);
    expect(isSignInLocked({}, now)).toBe(false);
    expect(isSignInLocked({ lockedUntil: 'not a date' }, now)).toBe(false);
    expect(isSignInLocked(null, now)).toBe(false);
  });

  it('counts minutes left, rounding up', () => {
    expect(lockMinutesLeft({ lockedUntil: '2026-10-08T10:14:10Z' }, now)).toBe(15);
    expect(lockMinutesLeft({ lockedUntil: '2026-10-08T10:00:05Z' }, now)).toBe(1);
    expect(lockMinutesLeft({ lockedUntil: null }, now)).toBe(0);
  });
});
