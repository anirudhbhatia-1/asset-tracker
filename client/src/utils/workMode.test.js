import { describe, expect, it } from 'vitest';
import { workModeLabel, normalizeWorkMode, showsWorkModeBadge, matchesWorkModeFilter } from './workMode';

describe('work mode', () => {
  it('labels modes, defaulting to Office', () => {
    expect(workModeLabel('remote')).toBe('Remote');
    expect(workModeLabel('hybrid')).toBe('Hybrid');
    expect(workModeLabel(undefined)).toBe('Office');
    expect(normalizeWorkMode('moon')).toBe('office');
  });

  it('badges only Hybrid and Remote', () => {
    expect(showsWorkModeBadge('office')).toBe(false);
    expect(showsWorkModeBadge('remote')).toBe(true);
    expect(showsWorkModeBadge('hybrid')).toBe(true);
  });

  it('filters the directory', () => {
    expect(matchesWorkModeFilter({ workMode: 'remote' }, 'all')).toBe(true);
    expect(matchesWorkModeFilter({ workMode: 'remote' }, 'remote')).toBe(true);
    expect(matchesWorkModeFilter({ workMode: 'hybrid' }, 'remote')).toBe(false);
    expect(matchesWorkModeFilter({}, 'office')).toBe(true);
  });
});
