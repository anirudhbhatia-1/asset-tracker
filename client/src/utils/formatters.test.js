import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatDateTime } from './formatters';

describe('formatters Unit Tests', () => {
  describe('formatCurrency', () => {
    it('should format numbers to USD currency string correctly', () => {
      expect(formatCurrency(1250.5)).toBe('$1,250.50');
      expect(formatCurrency(99)).toBe('$99.00');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle string numeric values gracefully', () => {
      expect(formatCurrency('2499.99')).toBe('$2,499.99');
    });

    it('should fallback to $0.00 for null, undefined, or non-numeric strings', () => {
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency('invalid')).toBe('$0.00');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string correctly', () => {
      expect(formatDate('2026-07-22')).toBe('Jul 22, 2026');
    });

    it('should format SQLite timestamp string correctly', () => {
      expect(formatDate('2026-07-22 14:30:00')).toBe('Jul 22, 2026');
    });

    it('should handle Date objects', () => {
      expect(formatDate(new Date(2026, 0, 15))).toBe('Jan 15, 2026');
    });

    it('should return N/A or Invalid Date for malformed inputs', () => {
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate('')).toBe('N/A');
      expect(formatDate('not-a-date')).toBe('Invalid Date');
    });
  });

  describe('formatDateTime', () => {
    it('should format date with hours and minutes', () => {
      const formatted = formatDateTime('2026-07-22 14:30:00');
      expect(formatted).toContain('Jul 22, 2026');
      expect(formatted).toContain('14:30');
    });
  });
});
