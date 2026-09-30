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
