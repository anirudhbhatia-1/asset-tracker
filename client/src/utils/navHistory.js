// Remembers the last two in-app locations so a page can link "back" to
// where the user actually came from (e.g. the inventory with its filters),
// without relying on the browser history stack. Fed by <LocationTracker />
// in App.jsx.

let current = null;
let previous = null;

const keyOf = (loc) => `${loc.pathname}${loc.search || ''}`;

export function recordLocation(loc) {
  if (!loc) return;
  const entry = { pathname: loc.pathname, search: loc.search || '', key: keyOf(loc) };
  if (current?.key === entry.key) return;
  // Query-only changes on the same page (filters, tabs) replace the entry,
  // so "previous" is the last *page* with its latest query string.
  if (current?.pathname === entry.pathname) {
    current = entry;
    return;
  }
  previous = current;
  current = entry;
}

/**
 * Where the user was before `here` ({ pathname, search }), or null. Works
 * whether or not `here` has been recorded yet, since a page reads this
 * during its first render, before the tracker's effect runs.
 */
export function getReferrer(here) {
  if (!here) return null;
  const hereKey = keyOf(here);
  if (current?.key === hereKey || current?.pathname === here.pathname) return previous;
  return current;
}

/** Test helper: forget recorded locations. */
export function resetNavHistory() {
  current = null;
  previous = null;
}
