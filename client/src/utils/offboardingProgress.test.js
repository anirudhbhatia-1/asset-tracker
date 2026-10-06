import { describe, it, expect } from 'vitest';
import { describeChecklistProgress } from './offboardingProgress';

describe('describeChecklistProgress', () => {
  it('names missing items instead of counting them as collected', () => {
    expect(describeChecklistProgress({ total: 4, returned: 3, missing: 1, pending: 0, collected: 4 }))
      .toBe('3 returned, 1 missing of 4');
  });

  it('says collected when nothing is missing', () => {
    expect(describeChecklistProgress({ total: 4, returned: 2, missing: 0, pending: 2, collected: 2 }))
      .toBe('2 of 4 collected');
  });

  it('falls back to resolved when only pending counts are known (list rows)', () => {
    expect(describeChecklistProgress({ total: 5, returned: null, missing: null, pending: 3, collected: 2 }))
      .toBe('2 of 5 resolved');
  });

  it('handles empty checklists', () => {
    expect(describeChecklistProgress({ total: 0 })).toBe('No assets');
    expect(describeChecklistProgress(undefined)).toBe('No assets');
  });
});
