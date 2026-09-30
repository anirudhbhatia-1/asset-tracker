import { describe, it, expect } from 'vitest';
import { addRecentScan, RECENT_SCANS_LIMIT } from './recentScans';

const asset = (id) => ({ id, name: `Asset ${id}`, serialNumber: `SN-${id}`, status: 'available', assetType: 'company', history: [] });

describe('addRecentScan', () => {
  it('adds newest first and keeps only the display fields', () => {
    const list = addRecentScan(addRecentScan([], asset(1)), asset(2));
    expect(list.map(s => s.id)).toEqual([2, 1]);
    expect(list[0]).toEqual({ id: 2, name: 'Asset 2', serialNumber: 'SN-2', status: 'available', assetType: 'company' });
  });

  it('moves a re-scanned asset to the top without duplicating it', () => {
    const list = [1, 2, 3].reduce((acc, id) => addRecentScan(acc, asset(id)), []);
    expect(addRecentScan(list, { ...asset(1), status: 'in-use' }).map(s => [s.id, s.status]))
      .toEqual([[1, 'in-use'], [3, 'available'], [2, 'available']]);
  });

  it(`keeps at most ${RECENT_SCANS_LIMIT} entries`, () => {
    const list = [1, 2, 3, 4, 5, 6, 7].reduce((acc, id) => addRecentScan(acc, asset(id)), []);
    expect(list.map(s => s.id)).toEqual([7, 6, 5, 4, 3]);
  });

  it('ignores assets without an id', () => {
    expect(addRecentScan([], null)).toEqual([]);
  });
});
