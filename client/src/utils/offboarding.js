// Offboarding (employee exit) helpers, mirrored from the server
// (offboardingService.js). Pure functions so they can be unit tested.
import { parseDateValue } from './dates';

export const OFFBOARDING_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const OFFBOARDING_REASONS = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'termination', label: 'Termination' },
  { value: 'contract_end', label: 'Contract ended' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'other', label: 'Other' },
];

const REASON_LABELS = Object.fromEntries(OFFBOARDING_REASONS.map(r => [r.value, r.label]));

/** Human label for a reason value, or null when none was given. */
export const getReasonLabel = (reason) => (reason ? (REASON_LABELS[reason] || reason) : null);

/** pending and in_progress requests can still be edited and worked on. */
export const isOpenOffboarding = (status) => status === 'pending' || status === 'in_progress';

// List tabs on the Offboarding page.
export const OFFBOARDING_FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

export const matchesOffboardingFilter = (request, filter) => {
  if (filter === 'all') return true;
  if (filter === 'open') return isOpenOffboarding(request?.status);
  return request?.status === filter;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How close an open request's last working day is:
 *   { tone: 'overdue' | 'soon' | 'upcoming', days, label }
 * `days` is calendar days from today (negative once passed). Closed requests
 * and unusable dates return null, so nothing is highlighted.
 */
export const getLastDayUrgency = (lastWorkingDate, status, now = new Date()) => {
  if (!isOpenOffboarding(status)) return null;
  const lastDay = parseDateValue(lastWorkingDate);
  if (Number.isNaN(lastDay.getTime())) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  lastDay.setHours(0, 0, 0, 0);
  const days = Math.round((lastDay - today) / DAY_MS);

  if (days < 0) {
    const ago = Math.abs(days);
    return { tone: 'overdue', days, label: `Overdue by ${ago} day${ago === 1 ? '' : 's'}` };
  }
  if (days === 0) return { tone: 'soon', days, label: 'Today' };
  if (days <= 7) return { tone: 'soon', days, label: `In ${days} day${days === 1 ? '' : 's'}` };
  return { tone: 'upcoming', days, label: `In ${days} days` };
};

/**
 * Counts for the asset checklist. `collected` counts every resolved item
 * (returned or reported missing), matching the server's pendingItems count.
 * Accepts either the item list or a list row's { totalItems, pendingItems }.
 */
export const getChecklistProgress = (itemsOrRequest) => {
  if (Array.isArray(itemsOrRequest)) {
    const total = itemsOrRequest.length;
    const returned = itemsOrRequest.filter(i => i.status === 'returned').length;
    const missing = itemsOrRequest.filter(i => i.status === 'missing').length;
    const pending = total - returned - missing;
    return { total, returned, missing, pending, collected: total - pending, percent: total ? Math.round(((total - pending) / total) * 100) : 0 };
  }
  const total = Number(itemsOrRequest?.totalItems) || 0;
  const pending = Math.min(Number(itemsOrRequest?.pendingItems) || 0, total);
  return { total, returned: null, missing: null, pending, collected: total - pending, percent: total ? Math.round(((total - pending) / total) * 100) : 0 };
};

/**
 * Nests accessories under the asset they are attached to. An item whose
 * parentAssetId is another checklist item's assetId becomes a child of that
 * item's top-level group (chains collapse onto their root); everything else
 * is top level. Order follows the input list.
 *
 * Returns [{ item, children: [{ item, parent }] }].
 */
export const groupChecklistItems = (items) => {
  const list = Array.isArray(items) ? items : [];
  const byAssetId = new Map(list.map(item => [String(item.assetId), item]));

  // The checklist item an item is attached to, or null.
  const parentOf = (item) => {
    if (item.parentAssetId == null) return null;
    const parent = byAssetId.get(String(item.parentAssetId));
    return parent && parent !== item ? parent : null;
  };

  const rootOf = (item) => {
    const seen = new Set([item]);
    let current = item;
    let parent = parentOf(current);
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      current = parent;
      parent = parentOf(current);
    }
    // A cycle (should not happen) leaves the item at top level.
    return parent ? item : current;
  };

  const groups = [];
  const groupByRoot = new Map();
  const ensureGroup = (root) => {
    let group = groupByRoot.get(root);
    if (!group) {
      group = { item: root, children: [] };
      groupByRoot.set(root, group);
      groups.push(group);
    }
    return group;
  };

  list.forEach((item) => {
    const root = rootOf(item);
    if (root === item) {
      ensureGroup(item);
    } else {
      ensureGroup(root).children.push({ item, parent: parentOf(item) });
    }
  });
  return groups;
};

/** Why "Complete" is unavailable, or null when it can be completed. */
export const getCompleteBlocker = (request) => {
  if (!request) return 'Loading…';
  if (!isOpenOffboarding(request.status)) return 'This offboarding is closed.';
  const items = Array.isArray(request.items) ? request.items : null;
  const pending = items ? getChecklistProgress(items).pending : Number(request.pendingItems) || 0;
  if (pending > 0) {
    return `${pending} asset${pending === 1 ? ' is' : 's are'} still pending. Mark each one returned or missing first.`;
  }
  return null;
};

/**
 * Employees who can be offboarded: still in the directory, not the signed-in
 * user, and without an open exit already.
 */
export const getOffboardableEmployees = (employees, currentUserId) => (
  (Array.isArray(employees) ? employees : []).filter(emp => (
    emp
    && !emp.deletedAt
    && !emp.offboarding
    && String(emp.id) !== String(currentUserId)
  ))
);
