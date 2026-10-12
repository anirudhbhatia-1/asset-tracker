import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BulkActionBar from './BulkActionBar';

const all = { assign: true, update: true, export: true };
const asset = (id, status = 'available') => ({ id, name: `A${id}`, status, assetType: 'company' });

describe('BulkActionBar', () => {
  it('renders nothing without a selection', () => {
    expect(renderToStaticMarkup(<BulkActionBar selectedAssets={[]} permissions={all} />)).toBe('');
  });
  it('shows actions by permission and explains a blocked assign', () => {
    const html = renderToStaticMarkup(<BulkActionBar selectedAssets={[asset(1), asset(2, 'in-use')]} permissions={all} />);
    expect(html).toContain('2 selected');
    expect(html).toContain('Assign to…');
    expect(html).toContain('1 of 2 selected');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?Assign to/);
    const readOnly = renderToStaticMarkup(<BulkActionBar selectedAssets={[asset(1)]} permissions={{}} />);
    expect(readOnly).not.toContain('Assign to');
    expect(readOnly).not.toContain('Export');
    expect(readOnly).toContain('QR labels');
  });
  it('warns over the 200 limit', () => {
    const many = Array.from({ length: 201 }, (_, i) => asset(i + 1));
    expect(renderToStaticMarkup(<BulkActionBar selectedAssets={many} permissions={all} />)).toContain('up to 200');
  });
  it('links each disabled button to its written reason via aria-describedby', () => {
    // Nothing assigned: Assign is blocked and Return has nothing to do.
    const html = renderToStaticMarkup(<BulkActionBar selectedAssets={[asset(1, 'retired')]} permissions={all} />);
    const described = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
    expect(described).toHaveLength(2); // Assign and Return
    for (const id of described) expect(html).toContain(`id="${id}"`);
    // The Return reason is visible text, not a title attribute.
    expect(html).toContain('nothing to return');
    expect(html).not.toContain('title=');
    // Enabled buttons carry no reason.
    const enabled = renderToStaticMarkup(<BulkActionBar selectedAssets={[asset(1), asset(2, 'in-use')]} permissions={all} />);
    expect(enabled).not.toMatch(/aria-describedby="[^"]*"[^>]*>[\s\S]{0,80}QR labels/);
  });
  it('points every disabled button at the over-limit warning', () => {
    const many = Array.from({ length: 201 }, (_, i) => asset(i + 1));
    const html = renderToStaticMarkup(<BulkActionBar selectedAssets={many} permissions={all} />);
    const described = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
    expect(described.length).toBe(5); // Assign, Return, Edit, Export, QR labels
    expect(new Set(described).size).toBe(1);
    expect(html).toContain(`id="${described[0]}"`);
  });
});
