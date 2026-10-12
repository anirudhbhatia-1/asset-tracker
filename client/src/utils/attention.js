// Helpers for the dashboard "Needs attention" panel (GET /dashboard/attention).

export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
export const MAX_ENTRIES = 5;

// Only in-app paths become links (never another site).
export const isInternalLink = (link) => typeof link === 'string' && link.startsWith('/') && !link.startsWith('//');

// Own keys only: an inherited name ("toString", "constructor") or any other
// unknown severity falls back to the lowest style instead of crashing.
const severityOf = (value) => (
  typeof value === 'string' && Object.hasOwn(SEVERITY_ORDER, value) ? value : 'low'
);

/**
 * Cleans and orders the server's items: drops malformed ones and ones with
 * nothing to do (count 0), keeps at most MAX_ENTRIES entries each, and sorts
 * by severity (high first; the server's order is kept within a severity).
 */
export function normalizeAttention(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item && item.key && item.title && Number(item.count) > 0)
    .map(({ item, index }) => ({
      index,
      key: String(item.key),
      severity: severityOf(item.severity),
      title: String(item.title),
      count: Number(item.count),
      link: isInternalLink(item.link) ? item.link : null,
      entries: (Array.isArray(item.entries) ? item.entries : [])
        .filter((entry) => entry && entry.label)
        .slice(0, MAX_ENTRIES)
        .map((entry) => ({
          label: String(entry.label),
          sublabel: entry.sublabel ? String(entry.sublabel) : '',
          link: isInternalLink(entry.link) ? entry.link : null,
        })),
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.index - b.index)
    .map(({ index: _index, ...item }) => item);
}

/** "3 items need attention · 1 urgent" style summary for the collapsed header. */
export function attentionSummary(items) {
  if (!items.length) return 'You’re all caught up';
  const high = items.filter((item) => item.severity === 'high').length;
  const base = `${items.length} item${items.length === 1 ? '' : 's'}`;
  return high ? `${base} · ${high} urgent` : base;
}
