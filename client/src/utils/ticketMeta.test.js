import { describe, expect, it } from 'vitest';
import { priorityLabel, priorityTone, ticketRef, ticketStatusTone, queueLabel, requestedThing, resolveRequestedItem } from './ticketMeta';

describe('ticket labels', () => {
  it('calls the hardware queue "Admin"', () => {
    expect(queueLabel('hardware')).toBe('Admin');
    expect(queueLabel('it')).toBe('IT Admin');
    expect(queueLabel('hardware', { short: true })).toBe('Admin');
  });
  it('labels priorities and falls back safely', () => {
    expect(priorityLabel('urgent')).toBe('Urgent');
    expect(priorityLabel(undefined)).toBe('Medium');
    expect(priorityTone('toString')).toBe('neutral');
    expect(priorityTone('urgent')).toBe('danger');
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

describe('ticket history labels', () => {
  it('names automatic steps and new event types', async () => {
    const { historyEventLabel, historyEventActor } = await import('./ticketMeta');
    expect(historyEventLabel({ event_type: 'transferred', performed_by: null })).toBe('Moved automatically');
    expect(historyEventLabel({ event_type: 'transferred', performed_by: 4 })).toBe('Transferred');
    expect(historyEventLabel({ event_type: 'priority_changed' })).toBe('Priority changed');
    expect(historyEventLabel({ event_type: 'escalated' })).toBe('Escalated');
    expect(historyEventActor({ performed_by: null })).toBe('Automatic');
    expect(historyEventActor({ performed_by: 3, performed_by_name: 'Asha' })).toBe('Asha');
  });
});

describe('ticket reference and status tone', () => {
  it('uses TK-0000 everywhere', () => {
    expect(ticketRef({ id: 606 })).toBe('TK-0606');
    expect(ticketRef({ id: 7, human_readable_id: 'TK-0007' })).toBe('TK-0007');
    expect(ticketRef({ id: 12345 })).toBe('TK-12345');
    expect(ticketRef(null)).toBe('');
  });

  it('keeps red away from Open', () => {
    expect(ticketStatusTone('open')).toBe('info');
    expect(ticketStatusTone('in_progress')).toBe('purple');
    expect(ticketStatusTone('weird')).toBe('neutral');
  });
});

describe('default department', () => {
  it('sends problems to IT Admin and requests to Admin', async () => {
    const { defaultQueueFor } = await import('./ticketMeta');
    expect(defaultQueueFor('issue')).toBe('it');
    expect(defaultQueueFor('request')).toBe('hardware');
  });
});
