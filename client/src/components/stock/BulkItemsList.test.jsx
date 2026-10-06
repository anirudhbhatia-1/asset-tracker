import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import BulkItemsList from './BulkItemsList';

const item = (overrides = {}) => ({
  id: 1,
  name: 'Laptop Bag',
  categoryName: 'Accessories',
  categoryBadgeChar: 'A',
  categoryColor: '#336699',
  location: 'Bengaluru',
  totalQuantity: 50,
  givenOut: 12,
  inStock: 38,
  isLowStock: false,
  lowStockThreshold: 5,
  ...overrides,
});

describe('BulkItemsList', () => {
  it('shows in stock / total and given out', () => {
    const html = renderToStaticMarkup(<BulkItemsList items={[item()]} />);
    expect(html).toContain('Laptop Bag');
    expect(html).toContain('38 / 50');
    expect(html).toContain('>12<');
    expect(html).toContain('Bengaluru');
    expect(html).not.toContain('Low stock');
  });

  it('flags low and out of stock items', () => {
    const html = renderToStaticMarkup(
      <BulkItemsList items={[item({ id: 2, inStock: 3, isLowStock: true }), item({ id: 3, name: 'Mouse Pad', inStock: 0, givenOut: 50, isLowStock: true })]} />,
    );
    expect(html).toContain('Low stock');
    expect(html).toContain('Out of stock');
  });

  it('offers Assign only with permission, disabled when nothing is in stock', () => {
    expect(renderToStaticMarkup(<BulkItemsList items={[item()]} />)).not.toContain('Assign');
    const html = renderToStaticMarkup(<BulkItemsList items={[item({ inStock: 0 })]} canAssign />);
    expect(html).toContain('Nothing in stock to give out');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Nothing in stock to give out"/);
  });
});
