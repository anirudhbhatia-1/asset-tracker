import { describe, it, expect } from 'vitest';
import { parseHex, resolveColor, relativeLuminance, contrastRatio, readableTextColor, DEFAULT_CATEGORY_COLOR } from './color';

describe('color helpers', () => {
  it('parses short and long hex values', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('6366F1')).toEqual([99, 102, 241]);
    expect(parseHex('nope')).toBeNull();
    expect(parseHex(null)).toBeNull();
  });

  it('resolves category colour names case-insensitively', () => {
    expect(resolveColor('Teal')).toBe('#14b8a6');
    expect(resolveColor('emerald')).toBe('#10b981');
    expect(resolveColor('  Cyan ')).toBe('#06b6d4');
  });

  it('normalises hex and falls back for unknown values', () => {
    expect(resolveColor('#ABC')).toBe('#aabbcc');
    expect(resolveColor('')).toBe(DEFAULT_CATEGORY_COLOR);
    expect(resolveColor(undefined)).toBe(DEFAULT_CATEGORY_COLOR);
    expect(resolveColor('chartreuse-ish', '#000000')).toBe('#000000');
  });

  it('computes WCAG luminance and contrast', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  });

  it('picks dark text on light fills and white on dark fills', () => {
    expect(readableTextColor('Amber')).toBe('#111827');
    expect(readableTextColor('Cyan')).toBe('#111827');
    expect(readableTextColor('Yellow')).toBe('#111827');
    expect(readableTextColor('#1e3a8a')).toBe('#ffffff');
    expect(readableTextColor('Slate')).toBe('#ffffff');
  });
});
