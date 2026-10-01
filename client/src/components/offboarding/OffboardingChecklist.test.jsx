import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import OffboardingChecklist from './OffboardingChecklist';

const items = [
  { id: 1, assetId: 10, assetName: 'MacBook Pro', serialNumber: 'MBP-1', parentAssetId: null, categoryName: 'Laptop', assetType: 'company', status: 'pending' },
  { id: 2, assetId: 11, assetName: 'USB-C Charger', serialNumber: 'CHG-1', parentAssetId: 10, categoryName: 'Charger', assetType: 'company', status: 'pending' },
  { id: 3, assetId: 20, assetName: 'Client Phone', serialNumber: 'PH-1', parentAssetId: null, categoryName: 'Phone', assetType: 'client', status: 'returned', condition: 'damaged', notes: 'Cracked screen', resolvedByName: 'IT Admin', resolvedAt: '2026-10-01T10:00:00Z' },
  { id: 4, assetId: 30, assetName: 'Monitor', serialNumber: 'MON-1', parentAssetId: null, categoryName: 'Monitor', assetType: 'company', status: 'missing' },
];

const render = (props) => renderToStaticMarkup(
  <OffboardingChecklist items={items} onReturn={vi.fn()} onRequestMissing={vi.fn()} {...props} />,
);

describe('OffboardingChecklist', () => {
  it('nests accessories under their asset with a hint', () => {
    const html = render();
    expect(html).toContain('Accessories of MacBook Pro');
    expect(html).toContain('Returns with MacBook Pro');
  });

  it('shows resolved outcomes with the client label, condition, note and who', () => {
    const html = render();
    expect(html).toContain('Returned to client');
    expect(html).toContain('Damaged');
    expect(html).toContain('Cracked screen');
    expect(html).toContain('By IT Admin');
    expect(html).toContain('Missing');
    expect(html).toContain('>Client<');
  });

  it('offers Returned / Missing only to collectors', () => {
    expect(render({ canCollect: true })).toContain('Mark MacBook Pro returned');
    const readOnly = render({ canCollect: false });
    expect(readOnly).not.toContain('Mark MacBook Pro returned');
    expect(readOnly).toContain('Pending return');
  });

  it('explains an empty checklist', () => {
    expect(renderToStaticMarkup(<OffboardingChecklist items={[]} />)).toContain('holds no assets');
  });
});
