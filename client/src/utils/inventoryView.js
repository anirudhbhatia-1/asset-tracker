// Small pure helpers for the Inventory page.

/** 'bulk' when the URL asks for the bulk-items view (?view=bulk), else 'assets'. */
export function viewFromParams(params) {
  return params?.get?.('view') === 'bulk' ? 'bulk' : 'assets';
}

/** Copy of `params` with ?view=bulk set for the bulk view, or removed for assets. */
export function withViewParam(params, view) {
  const next = new URLSearchParams(params);
  if (view === 'bulk') next.set('view', 'bulk');
  else next.delete('view');
  return next;
}

const SORT_FIELD_LABELS = {
  name: 'Name',
  serialNumber: 'Serial number',
  status: 'Status',
  warrantyExpiryDate: 'Warranty',
  location: 'Location',
  assigneeName: 'Assigned to',
  assignedDate: 'Assigned date',
  updatedAt: 'Last updated',
  createdAt: 'Date added',
};

const DATE_FIELDS = new Set(['warrantyExpiryDate', 'assignedDate', 'updatedAt', 'createdAt']);

/**
 * Human description of the table order, e.g.
 * sortLabel('updatedAt', 'desc') -> 'Last updated, newest first'.
 */
export function sortLabel(field, direction) {
  const label = SORT_FIELD_LABELS[field] || field;
  const asc = direction !== 'desc';
  if (DATE_FIELDS.has(field)) {
    if (field === 'warrantyExpiryDate') return `${label}, ${asc ? 'soonest first' : 'latest first'}`;
    return `${label}, ${asc ? 'oldest first' : 'newest first'}`;
  }
  return `${label}, ${asc ? 'A to Z' : 'Z to A'}`;
}

/** Number of active asset filters (search excluded; it has its own box). */
export function countActiveFilters({ categoryId, status, location, warranty } = {}) {
  return [categoryId, status, location, warranty].filter((v) => v && v !== 'all').length;
}

/**
 * Initial list/grid mode. A mode the user picked themselves (stored with the
 * `userChosen` flag) always wins; otherwise phones get the card grid and
 * wider screens the table.
 */
export function initialViewMode({ stored, userChosen, isPhone }) {
  if (userChosen && (stored === 'list' || stored === 'grid')) return stored;
  return isPhone ? 'grid' : 'list';
}
