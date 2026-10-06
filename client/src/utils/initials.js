/**
 * Avatar initials: first letter of the first word plus first letter of the
 * last word ("Priya Sharma" -> "PS", "Madonna" -> "M"). Falls back to
 * `fallback` when there is no usable name.
 */
export function getInitials(name, fallback = 'U') {
  const words = typeof name === 'string' ? name.trim().split(/\s+/).filter(Boolean) : [];
  if (words.length === 0) return fallback;
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}
