import { describe, it, expect } from 'vitest';
import { roleLabel } from './roleLabel';

describe('roleLabel', () => {
  it('prefers the role name from the server', () => {
    expect(roleLabel({ role: 'hr', roleName: 'HR Manager' })).toBe('HR Manager');
    expect(roleLabel({ role: 'it_admin', roleName: 'IT Admin' })).toBe('IT Admin');
  });

  it('tidies the role key when there is no distinct name', () => {
    expect(roleLabel({ role: 'hr', roleName: 'hr' })).toBe('HR');
    expect(roleLabel({ role: 'admin' })).toBe('Admin');
    expect(roleLabel({ role: 'asset_manager' })).toBe('Asset Manager');
  });

  it('falls back when there is no role', () => {
    expect(roleLabel(null, 'Employee')).toBe('Employee');
    expect(roleLabel({}, '—')).toBe('—');
  });
});
