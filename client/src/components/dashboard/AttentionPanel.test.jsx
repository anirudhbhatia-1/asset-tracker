import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AttentionPanel from './AttentionPanel';

const items = [
  { key: 'tickets_queue', severity: 'high', title: 'Open tickets', count: 2, link: '/tickets', entries: [] },
  { key: 'low_stock', severity: 'low', title: 'Low stock', count: 1, link: null, entries: [] },
];

vi.mock('../../hooks/useAttention', () => ({
  default: () => ({ items, loading: false, refreshing: false, error: null, refresh: () => {} }),
}));

const render = () => renderToStaticMarkup(<MemoryRouter><AttentionPanel /></MemoryRouter>);

describe('AttentionPanel heading', () => {
  it('separates the title from the count in the accessible name', () => {
    const html = render();
    // Without a separator the name reads "Needs attention2 items".
    expect(html).not.toMatch(/Needs attention<\/span><span[^>]*>2 items/);
    expect(html).toMatch(/Needs attention<\/span><span class="sr-only">:\s*<\/span>/);
    expect(html).toContain('2 items');
  });
});
