import { describe, expect, it } from 'vitest';
import { assignBlocker, focusSelectionAnchor, returnSummary, returnableCount, selectedAssetsOf, selectionState, setManySelected, toggleSelected } from './assetSelection';

const a = (id, status = 'available', assetType = 'company') => ({ id, name: `A${id}`, status, assetType });

describe('assetSelection', () => {
  it('toggles and sets many without mutating', () => {
    const s = new Set([1]);
    expect([...toggleSelected(s, 2)]).toEqual([1, 2]);
    expect([...toggleSelected(s, 1)]).toEqual([]);
    expect([...s]).toEqual([1]);
    expect([...setManySelected(s, [2, 3], true)]).toEqual([1, 2, 3]);
    expect([...setManySelected(new Set([1, 2, 3]), [1, 2], false)]).toEqual([3]);
  });
  it('reports header state', () => {
    expect(selectionState(new Set(), [1, 2])).toBe('none');
    expect(selectionState(new Set([1]), [1, 2])).toBe('some');
    expect(selectionState(new Set([1, 2, 9]), [1, 2])).toBe('all');
    expect(selectionState(new Set([1]), [])).toBe('none');
  });
  it('keeps only visible selected assets', () => {
    expect(selectedAssetsOf([a(1), a(2)], new Set([2, 5])).map((x) => x.id)).toEqual([2]);
  });
  it('explains when assign is blocked', () => {
    expect(assignBlocker([a(1), a(2)])).toBeNull();
    expect(assignBlocker([a(1), a(2, 'in-use')])).toMatch(/1 of 2/);
    expect(assignBlocker([a(1, 'available', 'client')])).toMatch(/can’t be assigned/);
    expect(returnableCount([a(1), a(2, 'in-use')])).toBe(1);
  });
  it('summarises returns incl. skipped with null names', () => {
    expect(returnSummary({ returned: 2, skipped: [] })).toBe('Returned 2 assets');
    expect(returnSummary({ returned: 1, skipped: [{ id: 9, name: null, reason: 'Asset not found' }] }))
      .toBe('Returned 1 asset; skipped 1: #9 (Asset not found)');
  });
});

describe('focusSelectionAnchor', () => {
  const fakeAnchor = () => {
    const calls = [];
    return { calls, focus: (opts) => calls.push(opts) };
  };

  it('focuses the first checkbox in the results region without scrolling', () => {
    const checkbox = fakeAnchor();
    const root = { querySelector: (sel) => (sel.includes('checkbox') ? checkbox : null) };
    expect(focusSelectionAnchor(root)).toBe(checkbox);
    expect(checkbox.calls).toEqual([{ preventScroll: true }]);
  });

  it('falls back to the region itself, made focusable', () => {
    const attrs = {};
    const root = {
      ...fakeAnchor(),
      querySelector: () => null,
      hasAttribute: (name) => name in attrs,
      setAttribute: (name, value) => { attrs[name] = value; },
    };
    expect(focusSelectionAnchor(root)).toBe(root);
    expect(attrs.tabindex).toBe('-1');
    expect(root.calls).toEqual([{ preventScroll: true }]);
  });

  it('does nothing when the region is gone', () => {
    expect(focusSelectionAnchor(null)).toBeNull();
  });
});
