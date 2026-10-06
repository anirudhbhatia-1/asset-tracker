import { describe, it, expect } from 'vitest';
import { getInitials } from './initials';

describe('getInitials', () => {
  it('uses the first letters of the first and last words', () => {
    expect(getInitials('Priya Sharma')).toBe('PS');
    expect(getInitials('anil kumar singh')).toBe('AS');
  });

  it('uses a single letter for one-word names', () => {
    expect(getInitials('Madonna')).toBe('M');
  });

  it('ignores extra whitespace', () => {
    expect(getInitials('  Ravi   Patel  ')).toBe('RP');
  });

  it('falls back when there is no name', () => {
    expect(getInitials('')).toBe('U');
    expect(getInitials(null)).toBe('U');
    expect(getInitials(undefined, '?')).toBe('?');
  });
});
