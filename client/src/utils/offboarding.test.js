import { describe, expect, it } from 'vitest';
import {
  groupChecklistItems,
  getChecklistProgress,
  getLastDayUrgency,
  getCompleteBlocker,
  getOffboardableEmployees,
  matchesOffboardingFilter,
  getReasonLabel,
} from './offboarding';

const item = (id, assetId, extra = {}) => ({ id, assetId, assetName: `Asset ${assetId}`, parentAssetId: null, status: 'pending', ...extra });

describe('groupChecklistItems', () => {
  it('nests accessories under the asset they are attached to', () => {
    const laptop = item(1, 10);
    const charger = item(2, 11, { parentAssetId: 10 });
    const phone = item(3, 20);
    const groups = groupChecklistItems([laptop, charger, phone]);
    expect(groups.map(g => g.item.id)).toEqual([1, 3]);
    expect(groups[0].children).toEqual([{ item: charger, parent: laptop }]);
    expect(groups[1].children).toEqual([]);
  });

  it('keeps an accessory whose parent is not on the checklist at top level', () => {
    const mouse = item(4, 30, { parentAssetId: 999 });
    expect(groupChecklistItems([mouse])).toEqual([{ item: mouse, children: [] }]);
  });

  it('groups children listed before their parent and collapses chains onto the root', () => {
    const dock = item(5, 41, { parentAssetId: 40 });
    const cable = item(6, 42, { parentAssetId: 41 });
    const laptop = item(7, 40);
    const groups = groupChecklistItems([cable, dock, laptop]);
    expect(groups).toHaveLength(1);
    expect(groups[0].item).toBe(laptop);
    expect(groups[0].children.map(c => [c.item.id, c.parent.id])).toEqual([[6, 5], [5, 7]]);
  });

  it('matches ids given as strings or numbers', () => {
    const groups = groupChecklistItems([item(1, '10'), item(2, 11, { parentAssetId: 10 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].children).toHaveLength(1);
  });

  it('does not loop on a parent cycle', () => {
    const a = item(1, 1, { parentAssetId: 2 });
    const b = item(2, 2, { parentAssetId: 1 });
    expect(groupChecklistItems([a, b]).map(g => g.item.id)).toEqual([1, 2]);
  });

  it('handles missing input', () => {
    expect(groupChecklistItems(undefined)).toEqual([]);
  });
});

describe('getChecklistProgress', () => {
  it('counts returned and missing items as collected', () => {
    const progress = getChecklistProgress([
      item(1, 1, { status: 'returned' }),
      item(2, 2, { status: 'missing' }),
      item(3, 3),
      item(4, 4),
    ]);
    expect(progress).toEqual({ total: 4, returned: 1, missing: 1, pending: 2, collected: 2, percent: 50 });
  });

  it('reads the counts of a list row', () => {
    expect(getChecklistProgress({ totalItems: 5, pendingItems: 3 })).toMatchObject({ total: 5, pending: 3, collected: 2, percent: 40 });
  });

  it('reports no assets as 0 of 0', () => {
    expect(getChecklistProgress([])).toMatchObject({ total: 0, collected: 0, percent: 0 });
    expect(getChecklistProgress({ totalItems: 0, pendingItems: 0 })).toMatchObject({ total: 0, percent: 0 });
  });
});

describe('getLastDayUrgency', () => {
  const now = new Date(2026, 9, 1, 15, 0); // 1 Oct 2026, afternoon

  it('flags open requests whose last day has passed', () => {
    expect(getLastDayUrgency('2026-09-29', 'in_progress', now)).toMatchObject({ tone: 'overdue', days: -2, label: 'Overdue by 2 days' });
  });

  it('flags today and the coming week as soon', () => {
    expect(getLastDayUrgency('2026-10-01', 'pending', now)).toMatchObject({ tone: 'soon', label: 'Today' });
    expect(getLastDayUrgency('2026-10-08', 'pending', now)).toMatchObject({ tone: 'soon', days: 7 });
    expect(getLastDayUrgency('2026-10-09', 'pending', now)).toMatchObject({ tone: 'upcoming', days: 8 });
  });

  it('does not highlight closed requests or bad dates', () => {
    expect(getLastDayUrgency('2026-09-01', 'completed', now)).toBeNull();
    expect(getLastDayUrgency('2026-09-01', 'cancelled', now)).toBeNull();
    expect(getLastDayUrgency('', 'pending', now)).toBeNull();
  });
});

describe('getCompleteBlocker', () => {
  it('blocks while items are pending', () => {
    expect(getCompleteBlocker({ status: 'in_progress', items: [item(1, 1), item(2, 2, { status: 'returned' })] }))
      .toBe('1 asset is still pending. Mark each one returned or missing first.');
  });

  it('allows completing when everything is resolved or nothing is held', () => {
    expect(getCompleteBlocker({ status: 'in_progress', items: [item(1, 1, { status: 'missing' })] })).toBeNull();
    expect(getCompleteBlocker({ status: 'pending', items: [] })).toBeNull();
  });

  it('blocks closed requests', () => {
    expect(getCompleteBlocker({ status: 'completed', items: [] })).toBe('This offboarding is closed.');
  });
});

describe('getOffboardableEmployees', () => {
  it('leaves out the signed-in user, removed employees and those already leaving', () => {
    const employees = [
      { id: 1, name: 'Me' },
      { id: 2, name: 'Leaving', offboarding: { id: 9, status: 'pending' } },
      { id: 3, name: 'Removed', deletedAt: '2026-01-01' },
      { id: 4, name: 'Active', offboarding: null },
    ];
    expect(getOffboardableEmployees(employees, '1').map(e => e.id)).toEqual([4]);
  });
});

describe('list filters and labels', () => {
  it('treats pending and in progress as open', () => {
    expect(matchesOffboardingFilter({ status: 'pending' }, 'open')).toBe(true);
    expect(matchesOffboardingFilter({ status: 'in_progress' }, 'open')).toBe(true);
    expect(matchesOffboardingFilter({ status: 'completed' }, 'open')).toBe(false);
    expect(matchesOffboardingFilter({ status: 'cancelled' }, 'cancelled')).toBe(true);
    expect(matchesOffboardingFilter({ status: 'cancelled' }, 'all')).toBe(true);
  });

  it('labels reasons', () => {
    expect(getReasonLabel('contract_end')).toBe('Contract ended');
    expect(getReasonLabel(null)).toBeNull();
  });
});

describe('Directors are offboarded only by Directors', () => {
  const staff = [
    { id: 1, name: 'Me' },
    { id: 2, name: 'Dee Director', role: 'director' },
    { id: 3, name: 'Ann Admin', role: 'admin' },
  ];
  it('leaves Directors out for everyone else', () => {
    expect(getOffboardableEmployees(staff, '1').map((e) => e.id)).toEqual([3]);
  });
  it('includes them for a Director', () => {
    expect(getOffboardableEmployees(staff, '1', { actorIsDirector: true }).map((e) => e.id)).toEqual([2, 3]);
  });
});

