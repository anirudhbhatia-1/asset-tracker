import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import employeeService from '../services/employeeService';
import { pool } from '../db';

describe('employeeService Unit & Security Tests', () => {
  let testEmployeeId;

  beforeAll(async () => {
    // Create test employee
    const res = await employeeService.createEmployee({
      name: 'Unit Test Employee',
      email: `test_emp_${Date.now()}@company.com`,
      department: 'Engineering',
      location: 'Bangalore'
    });
    testEmployeeId = res.id;
  });

  afterAll(async () => {
    if (testEmployeeId) {
      await pool.query('DELETE FROM employees WHERE id = $1', [testEmployeeId]);
    }
  });

  it('routine field update by user without employees:grant-access should succeed', async () => {
    const actingUserWithoutGrantAccess = {
      id: 999,
      email: 'hr_test@company.com',
      role: 'hr',
      permissions: ['employees:read', 'employees:manage']
    };

    const updated = await employeeService.updateEmployee(
      testEmployeeId,
      { name: 'Updated Employee Name', department: 'Product' },
      actingUserWithoutGrantAccess
    );

    expect(updated.name).toBe('Updated Employee Name');
    expect(updated.department).toBe('Product');
  });

  it('payload containing role from HR user with grant-access should silently drop role field', async () => {
    const actingUserHrWithGrantAccess = {
      id: 999,
      email: 'hr_grant@company.com',
      role: 'hr',
      permissions: ['employees:read', 'employees:manage', 'employees:grant-access']
    };

    const updated = await employeeService.updateEmployee(
      testEmployeeId,
      { department: 'Design', role: 'admin', roleId: 2 },
      actingUserHrWithGrantAccess
    );

    expect(updated.department).toBe('Design');
    // Role should not have changed to admin
    expect(updated.role).not.toBe('admin');
  });

  it('payload containing credential field (password) without employees:grant-access should throw 403', async () => {
    const actingUserNoGrantAccess = {
      id: 999,
      email: 'hr_test@company.com',
      role: 'hr',
      permissions: ['employees:read', 'employees:manage']
    };

    await expect(
      employeeService.updateEmployee(
        testEmployeeId,
        { password: 'newsecretpassword' },
        actingUserNoGrantAccess
      )
    ).rejects.toThrow(/employees:grant-access/);
  });
});
