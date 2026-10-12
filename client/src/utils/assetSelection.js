// Pure helpers for selecting assets in the inventory (bulk actions).

export const BULK_SELECTION_LIMIT = 200;

/** A new Set with `id` added or removed. */
export function toggleSelected(selected, id) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** A new Set with every id in `ids` added (checked) or removed. */
export function setManySelected(selected, ids, checked) {
  const next = new Set(selected);
  ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
  return next;
}

/** 'none' | 'some' | 'all' of `ids` selected (for a header checkbox). */
export function selectionState(selected, ids) {
  if (!ids.length) return 'none';
  let count = 0;
  ids.forEach((id) => { if (selected.has(id)) count += 1; });
  if (count === 0) return 'none';
  return count === ids.length ? 'all' : 'some';
}

/** The selected assets that are still in `assets`, in list order. */
export const selectedAssetsOf = (assets, selected) =>
  (Array.isArray(assets) ? assets : []).filter((asset) => selected.has(asset.id));

const isAssignable = (asset) => asset?.status === 'available' && (asset.assetType || 'company') === 'company';

/**
 * Why the selection can't be assigned together, or null when it can: only
 * available company assets can be handed out (the server assigns all or
 * none).
 */
export function assignBlocker(assets) {
  if (!assets.length) return 'Select assets to assign.';
  const blocked = assets.filter((asset) => !isAssignable(asset)).length;
  if (blocked === 0) return null;
  if (blocked === assets.length) {
    return assets.length === 1
      ? 'This asset isn’t an available company asset, so it can’t be assigned.'
      : 'None of these are available company assets, so they can’t be assigned.';
  }
  return `${blocked} of ${assets.length} selected aren’t available company assets. Assign works only when all of them are.`;
}

/** How many of the selection can be returned (currently assigned). */
export const returnableCount = (assets) => assets.filter((asset) => asset?.status === 'in-use').length;

/** Text for the bulk-return result toast. */
export function returnSummary({ returned = 0, skipped = [] } = {}) {
  const parts = [`Returned ${returned} asset${returned === 1 ? '' : 's'}`];
  if (skipped.length) {
    const named = skipped.slice(0, 3).map((s) => `${s.name || `#${s.id}`}${s.reason ? ` (${s.reason})` : ''}`).join(', ');
    const more = skipped.length > 3 ? ` and ${skipped.length - 3} more` : '';
    parts.push(`skipped ${skipped.length}: ${named}${more}`);
  }
  return parts.join('; ');
}

/**
 * After a bulk action succeeds and the selection is cleared, the action bar
 * (which held focus) unmounts and focus would fall to <body>. This puts it
 * on the results region's select-all checkbox — the natural place to start
 * the next selection — or on the region itself. Never scrolls.
 */
export function focusSelectionAnchor(root) {
  if (!root) return null;
  const anchor = root.querySelector?.('input[type="checkbox"]') || root;
  if (anchor === root && root.setAttribute && !root.hasAttribute?.('tabindex')) {
    root.setAttribute('tabindex', '-1');
  }
  anchor.focus?.({ preventScroll: true });
  return anchor;
}

/**
 * Keeps Enter/Space on a selection checkbox from reaching the row/card
 * underneath (which would open the asset). Every other key bubbles on, so
 * app-wide shortcuts (Ctrl+K, "/", Escape) still work while it has focus.
 */
export const stopActivationKeys = (e) => {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') e.stopPropagation();
};
