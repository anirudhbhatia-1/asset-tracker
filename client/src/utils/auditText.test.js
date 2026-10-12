import { describe, expect, it } from 'vitest';
import {
  auditChangeRows,
  auditGroupOf,
  describeAuditEvent,
  eventInGroup,
  eventTypeParamFor,
  listOf,
} from './auditText';

const asha = { actorId: 1, actorName: 'Asha' };
const ravi = { targetType: 'employee', targetId: 2, targetName: 'Ravi' };

describe('describeAuditEvent', () => {
  it('employee.role_changed', () => {
    expect(describeAuditEvent({
      eventType: 'employee.role_changed', ...asha, ...ravi,
      oldValue: { role: 'Employee' }, newValue: { role: 'Director' },
    })).toBe("Asha changed Ravi's role from Employee to Director");
    expect(describeAuditEvent({ eventType: 'employee.role_changed', ...asha, ...ravi, newValue: { role: 'HR' } }))
      .toBe("Asha changed Ravi's role to HR");
    expect(describeAuditEvent({ eventType: 'employee.role_changed', ...asha, ...ravi }))
      .toBe("Asha changed Ravi's role");
  });

  it('employee.access_granted', () => {
    expect(describeAuditEvent({ eventType: 'employee.access_granted', ...asha, ...ravi, newValue: { role: 'IT Admin' } }))
      .toBe('Asha gave Ravi sign-in access as IT Admin');
    expect(describeAuditEvent({ eventType: 'employee.access_granted', ...asha, ...ravi }))
      .toBe('Asha gave Ravi sign-in access');
  });

  it('employee.access_revoked', () => {
    expect(describeAuditEvent({ eventType: 'employee.access_revoked', ...asha, ...ravi }))
      .toBe("Asha removed Ravi's sign-in access");
  });

  it('employee.password_reset', () => {
    expect(describeAuditEvent({ eventType: 'employee.password_reset', ...asha, ...ravi }))
      .toBe("Asha reset Ravi's password");
  });

  it('employee.email_changed', () => {
    expect(describeAuditEvent({
      eventType: 'employee.email_changed', ...asha, ...ravi,
      oldValue: { email: 'ravi@old.com' }, newValue: { email: 'ravi@new.com' },
    })).toBe("Asha changed Ravi's email from ravi@old.com to ravi@new.com");
  });

  it('employee.removed', () => {
    expect(describeAuditEvent({ eventType: 'employee.removed', ...asha, ...ravi }))
      .toBe('Asha removed Ravi from the directory');
  });

  it('password.changed (own and someone else)', () => {
    expect(describeAuditEvent({ eventType: 'password.changed', ...asha, targetId: 1, targetName: 'Asha' }))
      .toBe('Asha changed their password');
    expect(describeAuditEvent({ eventType: 'password.changed', ...asha, ...ravi }))
      .toBe("Asha changed Ravi's password");
  });

  it('account.locked', () => {
    expect(describeAuditEvent({ eventType: 'account.locked', actorId: null, ...ravi, details: { failedAttempts: 10 } }))
      .toBe("Ravi's account was locked after 10 failed sign-ins");
    expect(describeAuditEvent({ eventType: 'account.locked', ...ravi }))
      .toBe("Ravi's account was locked after too many failed sign-ins");
    expect(describeAuditEvent({ eventType: 'account.locked' }))
      .toBe('An account was locked after too many failed sign-ins');
  });

  it('account.unlocked', () => {
    expect(describeAuditEvent({ eventType: 'account.unlocked', ...asha, ...ravi }))
      .toBe("Asha unlocked Ravi's account");
    expect(describeAuditEvent({ eventType: 'account.unlocked', ...ravi }))
      .toBe("Ravi's account was unlocked");
  });

  it('role.created / role.deleted', () => {
    expect(describeAuditEvent({ eventType: 'role.created', ...asha, targetType: 'role', targetName: 'Auditor' }))
      .toBe('Asha created role Auditor');
    expect(describeAuditEvent({ eventType: 'role.deleted', ...asha, targetType: 'role', oldValue: { name: 'Temp' } }))
      .toBe('Asha deleted role Temp');
  });

  it('role.updated lists permissions added and removed', () => {
    expect(describeAuditEvent({
      eventType: 'role.updated', ...asha, targetType: 'role', targetName: 'HR',
      newValue: { permissionsRemoved: ['assets:read', 'assets:update', 'tickets:read'] },
    })).toBe('Asha removed 3 permissions from role HR: assets:read, assets:update and tickets:read');
    expect(describeAuditEvent({
      eventType: 'role.updated', ...asha, targetType: 'role', targetName: 'HR',
      newValue: { permissionsAdded: ['audit:read'], permissionsRemoved: ['assets:read'] },
    })).toBe('Asha added 1 permission to role HR: audit:read and removed 1 permission from role HR: assets:read');
    expect(describeAuditEvent({ eventType: 'role.updated', ...asha, targetType: 'role', targetName: 'HR' }))
      .toBe('Asha updated role HR');
    expect(describeAuditEvent({
      eventType: 'role.updated', ...asha, targetType: 'role', targetName: 'People',
      oldValue: { name: 'HR' }, newValue: { name: 'People' },
    })).toBe('Asha renamed role HR to People');
  });

  it('data.exported / data.imported', () => {
    expect(describeAuditEvent({ eventType: 'data.exported', ...asha, targetType: 'system', details: { entity: 'assets', count: 347 } }))
      .toBe('Asha exported 347 assets');
    expect(describeAuditEvent({ eventType: 'data.imported', ...asha, targetType: 'system', details: { entity: 'assets', count: 1 } }))
      .toBe('Asha imported 1 asset');
    expect(describeAuditEvent({ eventType: 'data.exported', ...asha }))
      .toBe('Asha exported records');
  });

  it('falls back to a generic sentence for unknown types and missing names', () => {
    expect(describeAuditEvent({ eventType: 'employee.badge_printed', ...asha, ...ravi }))
      .toBe('Asha recorded "badge printed" for Ravi');
    expect(describeAuditEvent({ eventType: 'something.new', actorId: 9 }))
      .toBe('Someone recorded "new"');
    expect(describeAuditEvent({})).toBe('The system recorded "an action"');
    expect(describeAuditEvent(null)).toBe('The system recorded "an action"');
  });

  it('accepts JSON values sent as text', () => {
    expect(describeAuditEvent({
      eventType: 'employee.role_changed', ...asha, ...ravi,
      oldValue: '{"role":"Employee"}', newValue: '{"role":"HR"}',
    })).toBe("Asha changed Ravi's role from Employee to HR");
  });

  it('names ending in s take a bare apostrophe', () => {
    expect(describeAuditEvent({ eventType: 'employee.password_reset', ...asha, targetName: 'James' }))
      .toBe("Asha reset James' password");
  });
});

describe('filter groups', () => {
  it('maps groups to an eventType query value', () => {
    expect(eventTypeParamFor('all')).toBeUndefined();
    expect(eventTypeParamFor('data')).toBe('data.,asset.deleted,stock.deleted');
    expect(eventTypeParamFor('roles')).toBe('employee.role_changed,role.');
  });

  it('places every known type in a group', () => {
    expect(auditGroupOf('employee.role_changed')).toBe('roles');
    expect(auditGroupOf('role.updated')).toBe('roles');
    expect(auditGroupOf('employee.access_revoked')).toBe('access');
    expect(auditGroupOf('employee.password_reset')).toBe('passwords');
    expect(auditGroupOf('account.locked')).toBe('passwords');
    expect(auditGroupOf('data.imported')).toBe('data');
    expect(auditGroupOf('mystery')).toBe('other');
    expect(eventInGroup('mystery', 'all')).toBe(true);
    expect(eventInGroup('role.created', 'passwords')).toBe(false);
  });
});

describe('auditChangeRows', () => {
  it('pairs old and new values and appends extra details', () => {
    expect(auditChangeRows({
      oldValue: { role: 'Employee' },
      newValue: { role: 'Director', permissionsAdded: ['a', 'b'] },
      details: { ip: '10.0.0.1' },
    })).toEqual([
      { key: 'role', label: 'Role', from: 'Employee', to: 'Director' },
      { key: 'permissionsAdded', label: 'Permissions added', from: null, to: 'a, b' },
      { key: 'details.ip', label: 'IP address', from: null, to: '10.0.0.1' },
    ]);
    expect(auditChangeRows({})).toEqual([]);
  });

  it('listOf shortens long lists', () => {
    expect(listOf(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a, b, c, d and 2 more');
    expect(listOf([])).toBe('');
  });
});

describe('people, exits and deletions', () => {
  const base = { actorName: 'Asha', targetName: 'Ravi' };
  it('describes adding a person', () => {
    expect(describeAuditEvent({ ...base, eventType: 'employee.created', newValue: { department: 'IT' }, details: { withLogin: true } }))
      .toBe('Asha added Ravi to the directory (IT) with sign-in access');
    expect(describeAuditEvent({ ...base, eventType: 'employee.created', details: { withLogin: false } }))
      .toBe('Asha added Ravi to the directory');
  });
  it('describes an exit from start to finish', () => {
    expect(describeAuditEvent({ ...base, eventType: 'offboarding.started', newValue: { lastWorkingDate: '2026-10-20' }, details: { assetsToCollect: 3 } }))
      .toBe("Asha started Ravi's offboarding (last day 2026-10-20, 3 assets to collect)");
    expect(describeAuditEvent({ ...base, eventType: 'offboarding.completed', details: { revokedAccess: true, removedFromDirectory: false, returned: 2, missing: 1 } }))
      .toBe("Asha completed Ravi's offboarding and revoked their sign-in, 1 asset written off as missing");
    expect(describeAuditEvent({ ...base, eventType: 'offboarding.cancelled', details: {} }))
      .toBe("Asha cancelled Ravi's offboarding");
  });
  it('describes permanent deletions', () => {
    expect(describeAuditEvent({ actorName: 'Asha', targetName: 'MacBook Pro (C02XYZ)', eventType: 'asset.deleted', details: { serialNumber: 'C02XYZ' } }))
      .toBe('Asha permanently deleted asset MacBook Pro (C02XYZ)');
    expect(describeAuditEvent({ actorName: 'Asha', targetName: 'Laptop Bag', eventType: 'stock.deleted', details: { totalQuantity: 54 } }))
      .toBe('Asha removed bulk item Laptop Bag (54 in total)');
  });
  it('groups them under People & exits and Data', () => {
    expect(auditGroupOf('offboarding.started')).toBe('people');
    expect(auditGroupOf('employee.created')).toBe('people');
    expect(auditGroupOf('employee.removed')).toBe('people');
    expect(auditGroupOf('asset.deleted')).toBe('data');
    expect(auditGroupOf('stock.deleted')).toBe('data');
    expect(eventTypeParamFor('people')).toBe('employee.created,employee.removed,offboarding.');
  });
});

