import { describe, it, expect } from 'vitest';
import { viewFromParams, withViewParam, sortLabel, countActiveFilters, initialViewMode } from './inventoryView';

describe('viewFromParams / withViewParam', () => {
  it('reads the bulk view from ?view=bulk only', () => {
    expect(viewFromParams(new URLSearchParams('view=bulk'))).toBe('bulk');
    expect(viewFromParams(new URLSearchParams('view=other'))).toBe('assets');
    expect(viewFromParams(new URLSearchParams(''))).toBe('assets');
  });

  it('sets or removes view and keeps other params', () => {
    const params = new URLSearchParams('q=dell&status=in-use');
    expect(withViewParam(params, 'bulk').toString()).toBe('q=dell&status=in-use&view=bulk');
    expect(withViewParam(new URLSearchParams('q=dell&view=bulk'), 'assets').toString()).toBe('q=dell');
    // The input is not mutated.
    expect(params.toString()).toBe('q=dell&status=in-use');
  });
});

describe('sortLabel', () => {
  it('describes date sorts', () => {
    expect(sortLabel('updatedAt', 'desc')).toBe('Last updated, newest first');
    expect(sortLabel('assignedDate', 'asc')).toBe('Assigned date, oldest first');
    expect(sortLabel('warrantyExpiryDate', 'asc')).toBe('Warranty, soonest first');
  });

  it('describes text sorts', () => {
    expect(sortLabel('name', 'asc')).toBe('Name, A to Z');
    expect(sortLabel('serialNumber', 'desc')).toBe('Serial number, Z to A');
  });

  it('falls back to the field name', () => {
    expect(sortLabel('foo', 'asc')).toBe('foo, A to Z');
  });
});

describe('countActiveFilters', () => {
  it('counts filters other than "all"', () => {
    expect(countActiveFilters({ categoryId: 'all', status: 'all', location: 'all', warranty: 'all' })).toBe(0);
    expect(countActiveFilters({ categoryId: '3', status: 'in-use', location: 'all', warranty: 'expired' })).toBe(3);
    expect(countActiveFilters()).toBe(0);
  });
});

describe('initialViewMode', () => {
  it('keeps a mode the user chose', () => {
    expect(initialViewMode({ stored: 'list', userChosen: true, isPhone: true })).toBe('list');
    expect(initialViewMode({ stored: 'grid', userChosen: true, isPhone: false })).toBe('grid');
  });

  it('defaults to grid on phones and list elsewhere', () => {
    expect(initialViewMode({ stored: 'list', userChosen: false, isPhone: true })).toBe('grid');
    expect(initialViewMode({ stored: null, userChosen: false, isPhone: false })).toBe('list');
  });
});
