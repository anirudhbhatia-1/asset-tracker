import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatDateTime, getWarrantyBadge } from './formatters';

describe('formatters Unit Tests', () => {
  describe('formatCurrency', () => {
    it('should format numbers to INR currency string correctly', () => {
      expect(formatCurrency(1250.5)).toMatch(/₹\s?1,250\.50/);
      expect(formatCurrency(99)).toMatch(/₹\s?99\.00/);
      expect(formatCurrency(0)).toMatch(/₹\s?0\.00/);
    });

    it('should handle string numeric values gracefully', () => {
      expect(formatCurrency('2499.99')).toMatch(/₹\s?2,499\.99/);
    });

    it('should fallback to ₹0.00 for null, undefined, or non-numeric strings', () => {
      expect(formatCurrency(null)).toBe('₹0.00');
      expect(formatCurrency(undefined)).toBe('₹0.00');
      expect(formatCurrency('invalid')).toBe('₹0.00');
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
      expect(formatted).toContain('22/07/2026');
      expect(formatted).toContain('2:30 PM');
    });
  });

  describe('getWarrantyBadge', () => {
    const now = new Date(2026, 8, 30, 15, 0, 0); // local Sep 30 2026
    const local = (y, m, d) => new Date(y, m - 1, d);

    it('flags unknown warranty as muted', () => {
      expect(getWarrantyBadge(null, now)).toMatchObject({ label: 'No warranty', tone: 'muted' });
      expect(getWarrantyBadge('garbage', now)).toMatchObject({ label: 'No warranty', tone: 'muted' });
    });

    it('shows expired, today, and short countdowns in amber', () => {
      expect(getWarrantyBadge(local(2026, 9, 1), now)).toMatchObject({ label: 'Expired', tone: 'danger' });
      expect(getWarrantyBadge(local(2026, 9, 30), now)).toMatchObject({ label: 'Expires today', tone: 'warning' });
      expect(getWarrantyBadge(local(2026, 10, 12), now)).toMatchObject({ label: '12d left', tone: 'warning' });
      expect(getWarrantyBadge(local(2026, 11, 29), now)).toMatchObject({ label: '60d left', tone: 'warning' });
    });

    it('uses months and years for longer coverage', () => {
      expect(getWarrantyBadge(local(2027, 3, 30), now)).toMatchObject({ label: '6mo left', tone: 'success' });
      expect(getWarrantyBadge(local(2028, 10, 1), now)).toMatchObject({ label: '2y left', tone: 'success' });
    });
  });
});
