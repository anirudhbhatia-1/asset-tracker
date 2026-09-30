import { describe, expect, it } from 'vitest';
import { getFulfilmentCandidates, getOnboardingStatusOptions } from './onboardingStatus';

describe('getOnboardingStatusOptions', () => {
  it('lists the current status and its allowed moves', () => {
    expect(getOnboardingStatusOptions('pending')).toEqual(['pending', 'in_progress', 'arranged', 'cancelled']);
    expect(getOnboardingStatusOptions('arranged')).toEqual(['arranged', 'in_progress', 'completed', 'cancelled']);
    expect(getOnboardingStatusOptions('cancelled')).toEqual(['cancelled', 'pending']);
  });

  it('treats completed as final', () => {
    expect(getOnboardingStatusOptions('completed')).toEqual(['completed']);
  });
});

describe('getFulfilmentCandidates', () => {
  const assets = [
    { id: 1, categoryId: 3, status: 'available', assetType: 'company' },
    { id: 2, categoryId: 3, status: 'in-use', assetType: 'company' },
    { id: 3, categoryId: 3, status: 'available', assetType: 'client' },
    { id: 4, categoryId: 5, status: 'available', assetType: 'company' },
  ];

  it('keeps only available company assets of the item category', () => {
    expect(getFulfilmentCandidates(assets, { category_id: '3' }).map(a => a.id)).toEqual([1]);
  });

  it('accepts any category when the item has none', () => {
    expect(getFulfilmentCandidates(assets, { category_id: null }).map(a => a.id)).toEqual([1, 4]);
  });

  it('accepts the narrow rows from GET /assets/available', () => {
    const available = [{ id: 7, categoryId: 3 }, { id: 8, categoryId: 5 }];
    expect(getFulfilmentCandidates(available, { category_id: 3 }).map(a => a.id)).toEqual([7]);
  });
});
