import { describe, expect, it } from 'vitest';
import { priorityLabel, priorityStyle, queueLabel, requestedThing, resolveRequestedItem } from './ticketMeta';

describe('ticket labels', () => {
  it('calls the hardware queue "Admin"', () => {
    expect(queueLabel('hardware')).toBe('Admin');
    expect(queueLabel('it')).toBe('IT Admin');
    expect(queueLabel('hardware', { short: true })).toBe('Admin');
  });
  it('labels priorities and falls back safely', () => {
    expect(priorityLabel('urgent')).toBe('Urgent');
    expect(priorityLabel(undefined)).toBe('Medium');
    expect(priorityStyle('toString')).toBe(priorityStyle('medium'));
  });
});

describe('what do you need', () => {
  const categories = [{ id: 4, name: 'Laptop Stand' }, { id: 7, name: 'Monitor' }];
  it('links a typed category name to the category', () => {
    expect(resolveRequestedItem('  laptop  stand ', categories)).toEqual({ categoryId: 4, requestedItem: undefined });
  });
  it('keeps anything else as typed text', () => {
    expect(resolveRequestedItem('Ergonomic chair', categories)).toEqual({ categoryId: undefined, requestedItem: 'Ergonomic chair' });
    expect(resolveRequestedItem('   ', categories)).toEqual({ categoryId: undefined, requestedItem: undefined });
  });
  it('shows the category or the typed item', () => {
    expect(requestedThing({ category_name: 'Monitor' })).toBe('Monitor');
    expect(requestedThing({ requested_item: 'Chair' })).toBe('Chair');
    expect(requestedThing({})).toBeNull();
  });
});
