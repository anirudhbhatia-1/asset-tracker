// Helpers for bulk items: things without serial numbers (bags, cables, mouse
// pads) kept as one record with a count. Quantities are whole numbers.

export const MAX_STOCK_QUANTITY = 100000;

const toInt = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  if (typeof value !== 'string' || !/^\s*\d+\s*$/.test(value)) return NaN;
  return Number(value.trim());
};

/**
 * Checks a typed quantity. Returns an error message, or null when it is a
 * whole number from `min` to `max`.
 */
export const validateQuantity = (value, { min = 1, max = MAX_STOCK_QUANTITY, label = 'Quantity' } = {}) => {
  if (value === '' || value === null || value === undefined) return `${label} is required`;
  const n = toInt(value);
  if (Number.isNaN(n)) return `${label} must be a whole number`;
  if (n < min) return `${label} must be at least ${min}`;
  if (n > max) {
    return max === 0 ? `${label} must be 0` : `${label} can be at most ${max}`;
  }
  return null;
};

/** The number from a quantity input that passed validateQuantity. */
export const parseQuantity = (value) => toInt(value);

/** "38 / 50": in stock out of the total. */
export const stockCountLabel = (item) => `${item?.inStock ?? 0} / ${item?.totalQuantity ?? 0}`;

/**
 * Warning text for an item that is low or out, or null when stock is fine.
 * Out of stock is always flagged; "low" follows the server's isLowStock.
 */
export const lowStockText = (item) => {
  if (!item) return null;
  const inStock = item.inStock ?? 0;
  if (inStock <= 0 && (item.totalQuantity ?? 0) > 0) return 'Out of stock';
  if (item.isLowStock) {
    const threshold = item.lowStockThreshold;
    return threshold === null || threshold === undefined
      ? `Low stock: ${inStock} left`
      : `Low stock: ${inStock} left (warn at ${threshold})`;
  }
  return null;
};

/** "Laptop Bag × 2" */
export const holdingLabel = (holding) => `${holding?.name ?? 'Item'} × ${holding?.quantity ?? 0}`;

/**
 * Cost per unit typed in rupees → paise. '' gives null (no cost); anything
 * that is not a non-negative amount with at most 2 decimals gives NaN.
 */
export const rupeesToPaise = (value) => {
  const text = typeof value === 'number' ? String(value) : (value ?? '').trim();
  if (text === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  return Math.round(Number(text) * 100);
};

/** Paise → a rupee string for an input ('' when there is no cost). */
export const paiseToRupeesInput = (cents) => (
  cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace(/\.00$/, '')
);

/** Signed change for POST /stock/:id/adjust from a direction and amount. */
export const adjustmentChange = (direction, amount) => (direction === 'remove' ? -amount : amount);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Readable line for one history event. */
export const stockEventLabel = (event) => {
  const qty = event?.quantity ?? 0;
  const who = event?.employeeName || 'an employee';
  switch (event?.eventType) {
    case 'created': return qty > 0 ? `Added with ${plural(qty, 'unit')}` : 'Added';
    case 'restocked': return `Stock added: +${qty}`;
    case 'removed': return `Removed from shelf: −${qty}`;
    case 'assigned': return `Gave ${qty} to ${who}`;
    case 'returned': return `${who} returned ${qty}`;
    case 'written_off': return `Wrote off ${qty} from ${who} (lost or broken)`;
    case 'updated': return 'Details edited';
    case 'deleted': return 'Removed from the list';
    default: return event?.eventType ? String(event.eventType).replace(/_/g, ' ') : 'Change';
  }
};

/**
 * The event's note, or null when it only repeats the label (the server
 * writes e.g. "Added with N in stock" / "Given to Name" when no note is typed).
 */
export const stockEventNote = (event) => {
  const note = (event?.note || '').trim();
  if (!note) return null;
  if (event.eventType === 'created' && /^Added with \d+ in stock$/.test(note)) return null;
  const auto = {
    assigned: `Given to ${event.employeeName}`,
    returned: `Returned by ${event.employeeName}`,
    written_off: `Lost or damaged by ${event.employeeName}`,
  }[event.eventType];
  if (auto && event.employeeName && note === auto) return null;
  return note;
};

/** Tone for a history event dot: 'success' | 'warning' | 'error' | 'accent' | 'muted'. */
export const stockEventTone = (eventType) => {
  switch (eventType) {
    case 'created':
    case 'restocked':
    case 'returned':
      return 'success';
    case 'removed':
    case 'deleted':
      return 'warning';
    case 'written_off':
      return 'error';
    case 'assigned':
      return 'accent';
    default:
      return 'muted';
  }
};

/** Why an item cannot be deleted yet, or null when it can. */
export const deleteBlockedReason = (item) => (
  (item?.givenOut ?? 0) > 0
    ? `${plural(item.givenOut, 'unit')} still given out. Return or write them off first.`
    : null
);

/** Case-insensitive name filter for the bulk items list. */
export const filterStockItems = (items, query) => {
  const list = Array.isArray(items) ? items : [];
  const q = (query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => (item.name || '').toLowerCase().includes(q));
};
