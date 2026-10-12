import { describe, expect, it } from 'vitest';
import { attentionSummary, normalizeAttention } from './attention';

describe('normalizeAttention', () => {
  it('sorts by severity keeping server order, caps entries, drops bad links', () => {
    const items = normalizeAttention({ items: [
      { key: 'low_stock', severity: 'low', title: 'Low', count: 1, link: '/inventory?view=bulk', entries: [] },
      { key: 'tickets_queue', severity: 'high', title: 'Tickets', count: 7, link: '//evil.com', entries: Array.from({ length: 8 }, (_, i) => ({ label: `T${i}`, link: '/tickets?ticket=1' })) },
      { key: 'warranty_expiring', severity: 'medium', title: 'Warranty', count: 2, link: '/inventory?warranty=expiring-soon', entries: [{ label: 'X', link: 'https://x.com' }] },
      { key: 'locked_accounts', severity: 'high', title: 'Locked', count: 1, link: '/employees', entries: [] },
      { key: 'empty', severity: 'high', title: 'Zero', count: 0 },
      null,
    ] });
    expect(items.map((i) => i.key)).toEqual(['tickets_queue', 'locked_accounts', 'warranty_expiring', 'low_stock']);
    expect(items[0].entries).toHaveLength(5);
    expect(items[0].link).toBeNull();
    expect(items[2].entries[0].link).toBeNull();
    expect(attentionSummary(items)).toBe('4 items · 2 urgent');
    expect(attentionSummary([])).toMatch(/caught up/);
    expect(normalizeAttention(undefined)).toEqual([]);
  });

  it('treats unknown and inherited severities as low (own keys only)', () => {
    const items = normalizeAttention({ items: [
      { key: 'a', severity: 'toString', title: 'Inherited name', count: 1 },
      { key: 'b', severity: 'constructor', title: 'Another inherited name', count: 1 },
      { key: 'c', severity: 'urgent!!', title: 'Unknown', count: 1 },
      { key: 'd', severity: 42, title: 'Not a string', count: 1 },
      { key: 'e', title: 'Missing', count: 1 },
      { key: 'f', severity: 'high', title: 'Real', count: 1 },
    ] });
    expect(items.map((i) => i.severity)).toEqual(['high', 'low', 'low', 'low', 'low', 'low']);
    expect(items[0].key).toBe('f');
  });
});
