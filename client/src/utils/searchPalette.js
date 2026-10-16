// Pure helpers for the Ctrl+K command palette (components/search): turning
// the /api/search answer into one flat, keyboard-navigable list, the quick
// navigation commands a user may run, recently opened results and the
// shortcut label.
import { formatDate } from './formatters';
import { ticketRef, ticketStatusTone } from './ticketMeta';

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;
export const RECENT_LIMIT = 5;
export const RECENT_STORAGE_KEY = 'assettrack.recentSearchItems';

const SETTINGS_PERMISSIONS = ['roles:read', 'categories:manage', 'locations:manage', 'audit:read'];

const humanize = (value) => String(value || '').replace(/[_-]+/g, ' ').trim();
// Skips empty values and ones without a letter or digit (e.g. a stray ",").
const joinParts = (...parts) => parts
  .filter((part) => part !== null && part !== undefined && part !== false && /[\p{L}\p{N}]/u.test(String(part)))
  .join(' · ');

// Pill colour for a status, per kind of record.
// Pill tones (components/ui/Pill), the same as each record's badge elsewhere.
// Red is kept for things that need action now, so cancelled stays neutral.
const TONES = {
  asset: { available: 'success', 'in-use': 'info', retired: 'neutral', returned: 'accent' },
  onboarding: { pending: 'neutral', in_progress: 'warning', arranged: 'info', completed: 'success', cancelled: 'neutral' },
  offboarding: { pending: 'neutral', in_progress: 'warning', completed: 'success', cancelled: 'neutral' },
};

export const statusTone = (kind, status) => {
  const key = String(status || '').toLowerCase();
  if (kind === 'ticket') return ticketStatusTone(key);
  return TONES[kind]?.[key] || 'neutral';
};

const ASSET_STATUS_LABELS = { 'in-use': 'In use', returned: 'Returned to client' };
export const statusLabel = (kind, status) => {
  if (!status) return '';
  if (kind === 'asset' && ASSET_STATUS_LABELS[status]) return ASSET_STATUS_LABELS[status];
  const text = humanize(status);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Result groups in display order. `toItem` maps one server row to what the
 * palette shows: label, secondary text, status and where it links.
 */
export const SEARCH_GROUPS = [
  {
    key: 'assets',
    kind: 'asset',
    label: 'Assets',
    toItem: (a) => ({
      label: a.name || a.serialNumber || `Asset #${a.id}`,
      sublabel: joinParts(a.serialNumber, a.categoryName, a.assignedToName && `With ${a.assignedToName}`, a.assetType === 'client' && 'Client'),
      status: a.status,
      href: `/inventory/${a.id}`,
    }),
  },
  {
    key: 'stock',
    kind: 'stock',
    label: 'Bulk items',
    toItem: (s) => ({
      label: s.name || `Bulk item #${s.id}`,
      sublabel: joinParts(
        s.inStock != null && s.totalQuantity != null ? `${s.inStock} of ${s.totalQuantity} in stock` : null,
        s.location,
      ),
      status: null,
      href: `/inventory?view=bulk&item=${encodeURIComponent(s.id)}`,
    }),
  },
  {
    key: 'employees',
    kind: 'employee',
    label: 'People',
    toItem: (e) => ({
      label: e.name || e.email || `Employee #${e.id}`,
      sublabel: joinParts(e.email, e.department, e.workMode && e.workMode !== 'office' ? humanize(e.workMode) : null, e.deleted && 'Removed'),
      status: null,
      href: `/employees?employee=${encodeURIComponent(e.id)}`,
    }),
  },
  {
    key: 'tickets',
    kind: 'ticket',
    label: 'Tickets',
    toItem: (t) => ({
      label: t.title || ticketRef(t),
      sublabel: joinParts(ticketRef(t), humanize(t.type), t.employeeName, t.createdAt && formatDate(t.createdAt)),
      status: t.status,
      href: `/tickets?ticket=${encodeURIComponent(t.id)}`,
    }),
  },
  {
    key: 'onboarding',
    kind: 'onboarding',
    label: 'Onboarding',
    toItem: (o) => ({
      label: o.newHireName || `Onboarding #${o.id}`,
      sublabel: o.joiningDate ? `Joining ${formatDate(o.joiningDate)}` : '',
      status: o.status,
      href: `/onboarding?request=${encodeURIComponent(o.id)}`,
    }),
  },
  {
    key: 'offboarding',
    kind: 'offboarding',
    label: 'Offboarding',
    toItem: (o) => ({
      label: o.employeeName || `Offboarding #${o.id}`,
      sublabel: o.lastWorkingDate ? `Last day ${formatDate(o.lastWorkingDate)}` : '',
      status: o.status,
      href: `/offboarding?request=${encodeURIComponent(o.id)}`,
    }),
  },
];

/**
 * The search answer's groups as palette sections, in SEARCH_GROUPS order.
 * Groups the server left out (no permission) or that came back empty are
 * skipped. Every item gets a palette-wide unique `id`.
 */
export function resultSections(data) {
  if (!data || typeof data !== 'object') return [];
  return SEARCH_GROUPS
    .filter((group) => Array.isArray(data[group.key]) && data[group.key].length > 0)
    .map((group) => ({
      key: group.key,
      label: group.label,
      items: data[group.key]
        .filter((row) => row && row.id !== undefined && row.id !== null)
        .map((row) => ({
          type: 'result',
          kind: group.kind,
          id: `${group.kind}-${row.id}`,
          refId: row.id,
          ...group.toItem(row),
        })),
    }))
    .filter((section) => section.items.length > 0);
}

/** Navigation commands, with the permission each needs. */
export const COMMANDS = [
  { id: 'go-dashboard', label: 'Go to Dashboard', href: '/', icon: 'dashboard', keywords: 'home overview' },
  { id: 'go-inventory', label: 'Go to Inventory', href: '/inventory', icon: 'inventory', permission: 'assets:read', keywords: 'assets hardware devices' },
  { id: 'go-tickets', label: 'Go to Tickets', href: '/tickets', icon: 'ticket', permission: 'tickets:read', keywords: 'support requests issues' },
  { id: 'go-employees', label: 'Go to Employees', href: '/employees', icon: 'people', permission: 'employees:read', keywords: 'people directory staff' },
  { id: 'go-onboarding', label: 'Go to Onboarding', href: '/onboarding', icon: 'onboarding', permission: 'onboarding:read', keywords: 'new hire joiners' },
  { id: 'go-offboarding', label: 'Go to Offboarding', href: '/offboarding', icon: 'offboarding', permission: 'offboarding:read', keywords: 'exit leavers' },
  { id: 'go-settings', label: 'Go to Settings', href: '/settings', icon: 'settings', anyPermission: SETTINGS_PERMISSIONS, keywords: 'roles categories locations audit' },
  { id: 'new-asset', label: 'New asset', href: '/inventory/new', icon: 'plus', permission: 'assets:create', keywords: 'add create register hardware' },
  { id: 'raise-ticket', label: 'Raise ticket', href: '/tickets?new=1', icon: 'ticketPlus', permission: ['tickets:read', 'tickets:create'], keywords: 'new support request issue help' },
  { id: 'go-scanner', label: 'Scanner', href: '/scanner', icon: 'scanner', permission: 'scanner:read', keywords: 'qr scan serial barcode' },
];

const allowed = (command, can) => {
  if (command.anyPermission) return command.anyPermission.some((key) => can(key));
  if (!command.permission) return true;
  const needed = Array.isArray(command.permission) ? command.permission : [command.permission];
  return needed.every((key) => can(key));
};

/** The commands this user may run (`can` is AuthContext's hasPermission). */
export const availableCommands = (can) => COMMANDS
  .filter((command) => allowed(command, typeof can === 'function' ? can : () => false))
  .map((command) => ({ ...command, type: 'command' }));

/**
 * Commands matching the query: every word must appear in the label or
 * keywords. An empty query matches everything.
 */
export const filterCommands = (commands, query) => {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands;
  return commands.filter((command) => {
    const text = `${command.label} ${command.keywords || ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
};

export const inventorySearchItem = (query) => {
  const q = String(query || '').trim();
  return {
    type: 'action',
    id: 'inventory-search',
    icon: 'inventory',
    // ownership=all so client-owned assets show in the opened list too.
    label: `Search assets for “${q}” in Inventory`,
    href: `/inventory?q=${encodeURIComponent(q)}&ownership=all`,
  };
};

/**
 * Everything the palette lists for the current input, as sections:
 * - empty input: recently opened items, then all commands;
 * - 1 character: matching commands;
 * - 2+ characters: search results, matching commands, and (with
 *   assets:read) a "search the inventory" action.
 */
export function buildSections({ query = '', results = null, commands = [], recents = [], canSearchInventory = false }) {
  const q = String(query || '').trim();
  const sections = [];
  if (!q) {
    if (recents.length) sections.push({ key: 'recent', label: 'Recently opened', items: recents.map((item) => ({ ...item, type: 'result' })) });
    if (commands.length) sections.push({ key: 'commands', label: 'Quick navigation', items: commands });
    return sections;
  }
  if (q.length >= MIN_QUERY_LENGTH) sections.push(...resultSections(results));
  const matching = filterCommands(commands, q);
  if (matching.length) sections.push({ key: 'commands', label: 'Commands', items: matching });
  if (q.length >= MIN_QUERY_LENGTH && canSearchInventory) {
    sections.push({ key: 'inventory', label: 'Inventory', items: [inventorySearchItem(q)] });
  }
  return sections;
}

/**
 * Which option starts active. Once the search has settled (or there is no
 * search), the first option. While a search is still in flight, results on
 * screen belong to the previous query, so the first non-result option
 * (a command or the inventory action) starts active instead — never a
 * stale result. -1 when nothing may be active.
 */
export function defaultActiveIndex(items, { query = '', settled = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return -1;
  const q = String(query || '').trim();
  if (q.length < MIN_QUERY_LENGTH || settled) return 0;
  return list.findIndex((item) => item.type !== 'result');
}

/**
 * What Enter opens. While a search is still in flight (`settled` false for a
 * searchable query), Enter must never open a result of the previous query:
 * commands and actions (always built from the current text) still open, but
 * a stale result is replaced by the "Search assets in Inventory" action when
 * the user may read assets, and by nothing otherwise.
 */
export function enterTarget({ activeItem = null, query = '', settled = false, canSearchInventory = false } = {}) {
  const q = String(query || '').trim();
  const searching = q.length >= MIN_QUERY_LENGTH && !settled;
  if (!searching) return activeItem;
  if (activeItem && activeItem.type !== 'result') return activeItem;
  return canSearchInventory ? inventorySearchItem(q) : null;
}

/** All items of the sections in display order (what the arrow keys walk). */
export const flattenSections = (sections) => sections.flatMap((section) => section.items);

/** Number of search results (not commands) across sections. */
export const countResults = (sections) => sections
  .filter((section) => section.key !== 'commands' && section.key !== 'inventory' && section.key !== 'recent')
  .reduce((sum, section) => sum + section.items.length, 0);

/**
 * The active option after a key press: ArrowDown/ArrowUp wrap around,
 * Home/End jump to the ends. Returns null for keys it doesn't handle, and
 * -1 when there is nothing to select.
 */
export function nextActiveIndex(current, key, length) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return null;
  if (!length || length < 1) return -1;
  const from = Number.isInteger(current) && current >= 0 && current < length ? current : -1;
  switch (key) {
    case 'ArrowDown': return from === -1 ? 0 : (from + 1) % length;
    case 'ArrowUp': return from === -1 ? length - 1 : (from - 1 + length) % length;
    case 'Home': return 0;
    case 'End': return length - 1;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Recently opened results (localStorage, per user, at most RECENT_LIMIT).

const storage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const RECENT_FIELDS = ['id', 'kind', 'refId', 'label', 'sublabel', 'status', 'href'];
const pickRecent = (item) => Object.fromEntries(RECENT_FIELDS.filter((key) => item[key] !== undefined).map((key) => [key, item[key]]));

/** Puts `item` first (moving it up if present), keeping `limit` entries. */
export function addRecentItem(list, item, limit = RECENT_LIMIT) {
  const safe = Array.isArray(list) ? list : [];
  if (!item?.id || !item?.href) return safe.slice(0, limit);
  const entry = pickRecent(item);
  return [entry, ...safe.filter((existing) => existing.id !== entry.id)].slice(0, limit);
}

// Only internal paths are kept, so nothing stored can send the user off-site.
const isSafeHref = (href) => typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');

/** The user's recent items; anything stored for another user is ignored. */
export function loadRecentItems(userId) {
  const store = storage();
  if (!store || userId === undefined || userId === null) return [];
  try {
    const parsed = JSON.parse(store.getItem(RECENT_STORAGE_KEY) || 'null');
    if (!parsed || String(parsed.userId) !== String(userId) || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter((item) => item && item.id && item.label && isSafeHref(item.href)).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function saveRecentItems(userId, items) {
  const store = storage();
  if (!store || userId === undefined || userId === null) return;
  try {
    store.setItem(RECENT_STORAGE_KEY, JSON.stringify({ userId, items: items.slice(0, RECENT_LIMIT) }));
  } catch {
    // Storage full or blocked: recents are a convenience.
  }
}

/** Forgets recent items (sign-out). */
export function clearRecentItems() {
  try {
    storage()?.removeItem(RECENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Keyboard shortcut.

export const isMacPlatform = (nav = typeof navigator !== 'undefined' ? navigator : null) => {
  if (!nav) return false;
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
};

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. */
export const shortcutLabel = (mac = isMacPlatform()) => (mac ? '⌘K' : 'Ctrl K');

/** Whether the key event is the palette shortcut (Ctrl+K or ⌘K). */
export const isPaletteShortcut = (event) => Boolean(
  event && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
  && String(event.key).toLowerCase() === 'k',
);

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'number', 'password', 'tel', 'url', 'date', 'datetime-local', 'month', 'time', 'week']);

/** Whether the element takes typed text (so "/" must type, not open search). */
export const isTextEntryTarget = (el) => {
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return TEXT_INPUT_TYPES.has(String(el.type || '').toLowerCase());
  return false;
};
