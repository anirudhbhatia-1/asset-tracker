import { describe, it, expect } from 'vitest';
import { buildAssetTimeline } from './assetTimeline';

describe('buildAssetTimeline', () => {
  const history = [
    { id: 3, eventType: 'assigned', eventAt: '2026-09-20T10:00:00Z' },
    { id: 1, eventType: 'created', eventAt: '2026-09-01T10:00:00Z' },
  ];
  const tickets = [
    { id: 7, asset_id: 42, resolved_asset_id: null, created_at: '2026-09-25T09:00:00Z' },
    { id: 5, asset_id: null, resolved_asset_id: 42, created_at: '2026-09-18T09:00:00Z' },
  ];

  it('merges history and tickets newest first', () => {
    const entries = buildAssetTimeline(history, tickets, 42);
    expect(entries.map(e => e.key)).toEqual(['ticket-7', 'history-3', 'ticket-5', 'history-1']);
  });

  it('marks tickets as raised about the asset or fulfilled with it', () => {
    const entries = buildAssetTimeline([], tickets, 42);
    expect(entries.find(e => e.key === 'ticket-7').relation).toBe('raised');
    expect(entries.find(e => e.key === 'ticket-5').relation).toBe('fulfilled');
  });

  it('tolerates missing or non-array inputs', () => {
    expect(buildAssetTimeline(undefined, null, 1)).toEqual([]);
    expect(buildAssetTimeline(history).map(e => e.kind)).toEqual(['history', 'history']);
  });
});
