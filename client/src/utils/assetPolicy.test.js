import { describe, expect, it } from 'vitest';
import { CLIENT_LAPTOP_POLICY, assetSpecs, showsPrice } from './assetPolicy';

describe('asset policy helpers', () => {
  it('shows the price for client assets only', () => {
    expect(showsPrice({ assetType: 'client', costCents: 100 })).toBe(true);
    expect(showsPrice({ assetType: 'client', costCents: 0 })).toBe(true);
    expect(showsPrice({ assetType: 'company', costCents: 100 })).toBe(false);
    expect(showsPrice({ assetType: 'client', costCents: null })).toBe(false);
    expect(showsPrice(null)).toBe(false);
  });

  it('lists only the specs that are filled in, in order', () => {
    expect(assetSpecs({ ram: '16 GB', brand: 'Dell', os: '' })).toEqual([
      { key: 'brand', label: 'Brand', value: 'Dell' },
      { key: 'ram', label: 'RAM', value: '16 GB' },
    ]);
    expect(assetSpecs(null)).toEqual([]);
  });

  it('has both policy clauses', () => {
    expect(CLIENT_LAPTOP_POLICY).toHaveLength(2);
    expect(CLIENT_LAPTOP_POLICY[1]).toMatch(/monthly salary/);
  });
});
