import { describe, expect, it } from 'vitest';
import { exportFilename } from './download';
import { toLocalISODate } from './dates';

describe('exportFilename', () => {
  it('uses the local calendar date, not the UTC day', () => {
    // 00:30 on 2 Oct in a UTC+5:30 timezone is still 1 Oct in UTC; the file
    // must carry the local day the user sees.
    const date = new Date(2026, 9, 2, 0, 30);
    expect(exportFilename('', date)).toBe('AssetTrack_2026-10-02.xlsx');
    expect(exportFilename('', date)).toBe(`AssetTrack_${toLocalISODate(date)}.xlsx`);
  });

  it('appends an optional suffix before the extension', () => {
    const date = new Date(2026, 9, 2, 12);
    expect(exportFilename('5-selected', date)).toBe('AssetTrack_2026-10-02_5-selected.xlsx');
  });
});
