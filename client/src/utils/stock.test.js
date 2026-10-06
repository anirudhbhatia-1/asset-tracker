import { describe, expect, it } from 'vitest';
import {
  validateQuantity, parseQuantity, stockCountLabel, lowStockText, holdingLabel, rupeesToPaise,
  paiseToRupeesInput, adjustmentChange, stockEventLabel, stockEventNote, stockEventTone,
  deleteBlockedReason, filterStockItems,
} from './stock';

describe('validateQuantity', () => {
  it('accepts whole numbers in range', () => {
    expect(validateQuantity('1')).toBeNull();
    expect(validateQuantity(5, { max: 5 })).toBeNull();
    expect(validateQuantity('0', { min: 0 })).toBeNull();
  });

  it('rejects blanks, fractions and text', () => {
    expect(validateQuantity('')).toBe('Quantity is required');
    expect(validateQuantity('1.5')).toBe('Quantity must be a whole number');
    expect(validateQuantity('abc', { label: 'Amount' })).toBe('Amount must be a whole number');
    expect(validateQuantity('-2')).toBe('Quantity must be a whole number');
  });

  it('enforces min and max', () => {
    expect(validateQuantity('0')).toBe('Quantity must be at least 1');
    expect(validateQuantity('6', { max: 5 })).toBe('Quantity can be at most 5');
    expect(validateQuantity('100001', { min: 0 })).toBe('Quantity can be at most 100000');
  });

  it('parses the validated value', () => {
    expect(parseQuantity(' 12 ')).toBe(12);
    expect(Number.isNaN(parseQuantity('x'))).toBe(true);
  });
});

describe('labels', () => {
  it('shows in stock out of total', () => {
    expect(stockCountLabel({ inStock: 38, totalQuantity: 50 })).toBe('38 / 50');
    expect(stockCountLabel(null)).toBe('0 / 0');
  });

  it('describes a holding', () => {
    expect(holdingLabel({ name: 'Laptop Bag', quantity: 2 })).toBe('Laptop Bag × 2');
  });
});

describe('lowStockText', () => {
  it('is null when stock is fine', () => {
    expect(lowStockText({ inStock: 10, totalQuantity: 10, isLowStock: false, lowStockThreshold: 5 })).toBeNull();
    expect(lowStockText({ inStock: 0, totalQuantity: 0, isLowStock: false })).toBeNull();
  });

  it('flags low and out of stock', () => {
    expect(lowStockText({ inStock: 3, totalQuantity: 50, isLowStock: true, lowStockThreshold: 5 }))
      .toBe('Low stock: 3 left (warn at 5)');
    expect(lowStockText({ inStock: 0, totalQuantity: 50, isLowStock: true, lowStockThreshold: 5 })).toBe('Out of stock');
    expect(lowStockText({ inStock: 0, totalQuantity: 4, isLowStock: false, lowStockThreshold: null })).toBe('Out of stock');
  });
});

describe('money', () => {
  it('converts rupees to paise', () => {
    expect(rupeesToPaise('')).toBeNull();
    expect(rupeesToPaise('450')).toBe(45000);
    expect(rupeesToPaise('450.5')).toBe(45050);
    expect(rupeesToPaise('0.07')).toBe(7);
    expect(Number.isNaN(rupeesToPaise('4.567'))).toBe(true);
    expect(Number.isNaN(rupeesToPaise('-1'))).toBe(true);
  });

  it('formats paise for an input', () => {
    expect(paiseToRupeesInput(null)).toBe('');
    expect(paiseToRupeesInput(45000)).toBe('450');
    expect(paiseToRupeesInput(45050)).toBe('450.50');
  });
});

describe('stock changes and history', () => {
  it('signs an adjustment', () => {
    expect(adjustmentChange('add', 20)).toBe(20);
    expect(adjustmentChange('remove', 3)).toBe(-3);
  });

  it('labels each event type', () => {
    expect(stockEventLabel({ eventType: 'created', quantity: 50 })).toBe('Added with 50 units');
    expect(stockEventLabel({ eventType: 'restocked', quantity: 20 })).toBe('Stock added: +20');
    expect(stockEventLabel({ eventType: 'removed', quantity: 3 })).toBe('Removed from shelf: −3');
    expect(stockEventLabel({ eventType: 'assigned', quantity: 2, employeeName: 'Priya' })).toBe('Gave 2 to Priya');
    expect(stockEventLabel({ eventType: 'returned', quantity: 1, employeeName: 'Priya' })).toBe('Priya returned 1');
    expect(stockEventLabel({ eventType: 'written_off', quantity: 1, employeeName: 'Priya' })).toBe('Wrote off 1 from Priya (lost or broken)');
    expect(stockEventLabel({ eventType: 'updated' })).toBe('Details edited');
    expect(stockEventLabel({ eventType: 'deleted' })).toBe('Removed from the list');
  });

  it('drops notes that only repeat the label', () => {
    expect(stockEventNote({ eventType: 'created', note: 'Added with 50 in stock' })).toBeNull();
    expect(stockEventNote({ eventType: 'assigned', employeeName: 'Priya', note: 'Given to Priya' })).toBeNull();
    expect(stockEventNote({ eventType: 'returned', employeeName: 'Priya', note: 'Returned by Priya' })).toBeNull();
    expect(stockEventNote({ eventType: 'written_off', employeeName: 'Priya', note: 'Lost or damaged by Priya' })).toBeNull();
    expect(stockEventNote({ eventType: 'assigned', employeeName: 'Priya', note: 'For travel' })).toBe('For travel');
  });

  it('gives each event a tone', () => {
    expect(stockEventTone('written_off')).toBe('error');
    expect(stockEventTone('restocked')).toBe('success');
    expect(stockEventTone('assigned')).toBe('accent');
    expect(stockEventTone('updated')).toBe('muted');
  });

  it('blocks delete while units are given out', () => {
    expect(deleteBlockedReason({ givenOut: 0 })).toBeNull();
    expect(deleteBlockedReason({ givenOut: 1 })).toBe('1 unit still given out. Return or write them off first.');
  });

  it('filters by name, ignoring case', () => {
    const items = [{ name: 'Laptop Bag' }, { name: 'USB-C Cable' }];
    expect(filterStockItems(items, 'bag')).toEqual([{ name: 'Laptop Bag' }]);
    expect(filterStockItems(items, '  ')).toEqual(items);
    expect(filterStockItems(null, 'x')).toEqual([]);
  });
});
