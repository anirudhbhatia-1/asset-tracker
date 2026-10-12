/**
 * Copy of `params` with `key` set to `value` (trimmed), or removed when the
 * value is blank. Every other query param is kept, so e.g. the TopBar search
 * doesn't wipe the inventory filters.
 */
export const withSearchParam = (params, key, value) => {
  const next = new URLSearchParams(params);
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed) next.set(key, trimmed);
  else next.delete(key);
  return next;
};

/**
 * What a ?key=<id> deep link should do, given the state of the list it
 * points into:
 * - 'wait'      — the list is still loading or refreshing; decide later;
 * - 'open'      — `match` is the record to open;
 * - 'error'     — the list failed to load, so whether the record exists is
 *                 unknown ("not found" would mislead); leave the link so a
 *                 retry can honour it;
 * - 'not-found' — the list settled cleanly without the record.
 */
export function resolveDeepLink({ id, list, loading = false, refreshing = false, error = null, idOf = (row) => row?.id }) {
  if (loading || refreshing) return { status: 'wait', match: null };
  const rows = Array.isArray(list) ? list : [];
  const match = rows.find((row) => String(idOf(row)) === String(id)) || null;
  if (match) return { status: 'open', match };
  return { status: error ? 'error' : 'not-found', match: null };
}
