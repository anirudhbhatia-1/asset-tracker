import { describe, expect, it } from 'vitest';

import employeeService from '../services/employeeService';
import ticketService from '../services/ticketService';

const { assertCanActOnRole } = employeeService;
const { getStatusEventType } = ticketService;

const director = { role: 'director', isDirector: true, permissions: ['*'] };
const admin = {
  role: 'admin',
  permissions: ['employees:create', 'employees:grant-access', 'assets:read', 'tickets:resolve'],
};
const hr = { role: 'hr', permissions: ['employees:create', 'employees:manage', 'tickets:read'] };

const directorRole = { isDirector: true, permissions: ['*'] };
const adminRole = { isDirector: false, permissions: ['employees:create', 'assets:read', 'tickets:resolve'] };
const defaultEmployeeRole = { isDirector: false, isDefaultEmployeeRole: true, permissions: ['locations:read'] };

describe('role assignment privilege checks', () => {
  it('lets only a Director assign or manage the Director role', () => {
    expect(() => assertCanActOnRole(director, directorRole, 'assign')).not.toThrow();
    expect(() => assertCanActOnRole(admin, directorRole, 'assign')).toThrow(/only a Director/);
    expect(() => assertCanActOnRole(hr, directorRole, 'change the email of')).toThrow(/only a Director/);
  });

  it('rejects roles carrying permissions the caller does not hold', () => {
    let error;
    try {
      assertCanActOnRole(hr, adminRole, 'assign');
    } catch (err) {
      error = err;
    }
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('assets:read');
  });

  it('allows roles within the caller\'s own permissions', () => {
    expect(() => assertCanActOnRole(admin, adminRole, 'assign')).not.toThrow();
  });

  it('always allows the built-in Employee role and accounts without a role', () => {
    expect(() => assertCanActOnRole(hr, defaultEmployeeRole, 'assign')).not.toThrow();
    expect(() => assertCanActOnRole(hr, null, 'change the email of')).not.toThrow();
  });

  it('rejects unauthenticated callers', () => {
    expect(() => assertCanActOnRole(undefined, adminRole, 'assign')).toThrow(/authenticated/);
  });
});

describe('ticket status history events', () => {
  it('maps statuses onto event types allowed by ticket_history', () => {
    expect(getStatusEventType('open')).toBe('status_changed');
    expect(getStatusEventType('in_progress')).toBe('status_changed');
    expect(getStatusEventType('resolved')).toBe('resolved');
    expect(getStatusEventType('rejected')).toBe('rejected');
    expect(getStatusEventType('closed')).toBe('closed');
  });
});
