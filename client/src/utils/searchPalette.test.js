import { describe, expect, it } from 'vitest';
import {
  addRecentItem, availableCommands, buildSections, countResults, defaultActiveIndex, enterTarget,
  filterCommands, flattenSections, inventorySearchItem, isPaletteShortcut, isTextEntryTarget,
  nextActiveIndex, resultSections, shortcutLabel, statusTone,
} from './searchPalette';

const data = {
  assets: [{ id: 7, name: 'MacBook Pro', serialNumber: 'SN-1', status: 'available', categoryName: 'Laptop' }],
  employees: [{ id: 3, name: 'Asha', email: 'asha@x.com', department: 'IT' }],
  tickets: [],
  stock: [{ id: 2, name: 'Bag', inStock: 4, totalQuantity: 10, location: 'Pune' }],
};

describe('resultSections', () => {
  it('keeps group order, skips empty/missing groups and builds links', () => {
    const sections = resultSections(data);
    expect(sections.map((s) => s.key)).toEqual(['assets', 'stock', 'employees']);
    const [asset] = sections[0].items;
    expect(asset).toMatchObject({ id: 'asset-7', href: '/inventory/7', status: 'available' });
    expect(asset.sublabel).toContain('SN-1');
    expect(sections[1].items[0].href).toBe('/inventory?view=bulk&item=2');
    expect(sections[1].items[0].sublabel).toContain('4 of 10 in stock');
    expect(sections[2].items[0].href).toBe('/employees?employee=3');
  });
  it('handles junk', () => {
    expect(resultSections(null)).toEqual([]);
    expect(resultSections({ assets: [null, {}] })).toEqual([]);
  });
});

describe('commands', () => {
  const can = (keys) => (k) => keys.includes(k);
  it('only lists permitted commands', () => {
    const ids = availableCommands(can(['tickets:read'])).map((c) => c.id);
    expect(ids).toContain('go-tickets');
    expect(ids).not.toContain('raise-ticket');
    expect(ids).not.toContain('go-inventory');
    expect(ids).not.toContain('go-settings');
    const more = availableCommands(can(['tickets:read', 'tickets:create', 'audit:read'])).map((c) => c.id);
    expect(more).toEqual(expect.arrayContaining(['raise-ticket', 'go-settings']));
  });
  it('filters by every word in label or keywords', () => {
    const cmds = availableCommands(() => true);
    expect(filterCommands(cmds, 'go inv').map((c) => c.id)).toEqual(['go-inventory']);
    expect(filterCommands(cmds, 'qr').map((c) => c.id)).toEqual(['go-scanner']);
    expect(filterCommands(cmds, '')).toHaveLength(cmds.length);
  });
});

describe('buildSections / flatten', () => {
  const commands = availableCommands(() => true);
  it('shows recents then commands when empty', () => {
    const recents = [{ id: 'asset-7', kind: 'asset', label: 'MacBook', href: '/inventory/7' }];
    const sections = buildSections({ query: '', commands, recents });
    expect(sections.map((s) => s.key)).toEqual(['recent', 'commands']);
    expect(flattenSections(sections)[0].id).toBe('asset-7');
  });
  it('adds results, matching commands and the inventory action', () => {
    const sections = buildSections({ query: 'mac', results: data, commands, canSearchInventory: true });
    expect(sections.map((s) => s.key)).toEqual(['assets', 'stock', 'employees', 'inventory']);
    expect(countResults(sections)).toBe(3);
    const flat = flattenSections(sections);
    // ownership=all so client-owned assets show in the opened search too.
    expect(flat.at(-1).href).toBe('/inventory?q=mac&ownership=all');
    expect(new Set(flat.map((i) => i.id)).size).toBe(flat.length);
  });
  it('one character searches commands only', () => {
    const sections = buildSections({ query: 's', results: data, commands, canSearchInventory: true });
    expect(sections.map((s) => s.key)).toEqual(['commands']);
  });
});

describe('nextActiveIndex', () => {
  it('wraps arrows and jumps with Home/End', () => {
    expect(nextActiveIndex(0, 'ArrowDown', 3)).toBe(1);
    expect(nextActiveIndex(2, 'ArrowDown', 3)).toBe(0);
    expect(nextActiveIndex(0, 'ArrowUp', 3)).toBe(2);
    expect(nextActiveIndex(-1, 'ArrowUp', 3)).toBe(2);
    expect(nextActiveIndex(1, 'Home', 3)).toBe(0);
    expect(nextActiveIndex(1, 'End', 3)).toBe(2);
    expect(nextActiveIndex(1, 'Enter', 3)).toBeNull();
    expect(nextActiveIndex(0, 'ArrowDown', 0)).toBe(-1);
  });
});

describe('stale-search selection (defaultActiveIndex / enterTarget)', () => {
  const staleResult = { type: 'result', id: 'asset-7', href: '/inventory/7' };
  const command = { type: 'command', id: 'go-inventory', href: '/inventory' };
  const action = { type: 'action', id: 'inventory-search', href: '/inventory?q=mac&ownership=all' };

  it('starts on the first option once settled, or with no live search', () => {
    expect(defaultActiveIndex([staleResult, command], { query: 'mac', settled: true })).toBe(0);
    expect(defaultActiveIndex([staleResult, command], { query: '', settled: false })).toBe(0); // recents + commands
    expect(defaultActiveIndex([command], { query: 's', settled: false })).toBe(0); // too short to search
    expect(defaultActiveIndex([], { query: 'mac', settled: true })).toBe(-1);
  });

  it('never starts on a stale result while the search is in flight', () => {
    expect(defaultActiveIndex([staleResult, command, action], { query: 'mac', settled: false })).toBe(1);
    expect(defaultActiveIndex([staleResult], { query: 'mac', settled: false })).toBe(-1);
  });

  it('Enter opens the active item once settled', () => {
    expect(enterTarget({ activeItem: staleResult, query: 'mac', settled: true })).toBe(staleResult);
    expect(enterTarget({ activeItem: staleResult, query: '', settled: false })).toBe(staleResult); // a recent item
  });

  it('Enter while in flight never opens a stale result', () => {
    const target = enterTarget({ activeItem: staleResult, query: 'mac', settled: false, canSearchInventory: true });
    expect(target).toEqual(inventorySearchItem('mac'));
    expect(target.href).toBe('/inventory?q=mac&ownership=all');
    // Without assets:read there is nothing safe to open.
    expect(enterTarget({ activeItem: staleResult, query: 'mac', settled: false, canSearchInventory: false })).toBeNull();
    expect(enterTarget({ activeItem: null, query: 'mac', settled: false, canSearchInventory: false })).toBeNull();
  });

  it('Enter while in flight still runs commands and actions (built from the current text)', () => {
    expect(enterTarget({ activeItem: command, query: 'mac', settled: false, canSearchInventory: true })).toBe(command);
    expect(enterTarget({ activeItem: action, query: 'mac', settled: false, canSearchInventory: true })).toBe(action);
  });
});

describe('recents and keys', () => {
  it('moves an item to the front and caps the list', () => {
    let list = [];
    for (let i = 0; i < 7; i += 1) list = addRecentItem(list, { id: `a-${i}`, label: `A${i}`, href: `/x/${i}`, extra: 1 });
    expect(list).toHaveLength(5);
    expect(list[0].id).toBe('a-6');
    expect(list[0].extra).toBeUndefined();
    list = addRecentItem(list, { id: 'a-4', label: 'A4', href: '/x/4' });
    expect(list.map((i) => i.id)).toEqual(['a-4', 'a-6', 'a-5', 'a-3', 'a-2']);
  });
  it('detects the shortcut and text fields', () => {
    expect(isPaletteShortcut({ key: 'k', ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: 'K', metaKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: 'k', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isTextEntryTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTextEntryTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(shortcutLabel(true)).toBe('⌘K');
    expect(shortcutLabel(false)).toBe('Ctrl K');
    expect(statusTone('ticket', 'open')).toBe('warning');
    expect(statusTone('asset', 'weird')).toBe('muted');
  });
});
