// Colour helpers for user-chosen category colours.
//
// Categories store either a hex value (from the category builder) or a colour
// name (seed data and CSV imports use Tailwind names such as "Teal" or
// "Emerald", several of which aren't valid CSS colours). Names resolve to the
// Tailwind 500 shade so they match the builder's palette.

const NAMED_COLORS = {
  slate: '#64748b',
  gray: '#6b7280',
  grey: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  black: '#000000',
  white: '#ffffff',
};

export const DEFAULT_CATEGORY_COLOR = '#6366f1';

/** Expands #rgb / #rrggbb (with or without '#') to [r, g, b], or null. */
export function parseHex(value) {
  if (typeof value !== 'string') return null;
  let hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * Turns a stored category colour into a CSS hex colour. Unknown or empty
 * values fall back to `fallback` so a badge is never left without a fill.
 */
export function resolveColor(value, fallback = DEFAULT_CATEGORY_COLOR) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const trimmed = value.trim();
  const named = NAMED_COLORS[trimmed.toLowerCase()];
  if (named) return named;
  const rgb = parseHex(trimmed);
  if (rgb) return `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  return fallback;
}

/** WCAG relative luminance (0 = black, 1 = white) of a colour value. */
export function relativeLuminance(value) {
  const rgb = parseHex(resolveColor(value));
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colour values (1 to 21). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Black or white, whichever reads better on `background`. Returns a hex
 * value; near-black (#111827) is used instead of pure black.
 */
export function readableTextColor(background) {
  const dark = '#111827';
  const light = '#ffffff';
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}
