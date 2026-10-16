/**
 * Addresses of an office location. The API may send them as an array or as
 * a JSON-encoded string; anything malformed yields an empty list instead of
 * throwing during render.
 */
export function parseLocationAddresses(location) {
  const raw = location?.addresses;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
