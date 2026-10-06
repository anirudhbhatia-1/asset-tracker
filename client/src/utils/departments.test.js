import { describe, it, expect } from 'vitest';
import { distinctDepartments } from './departments';

describe('distinctDepartments', () => {
  it('returns unique sorted departments', () => {
    const employees = [
      { department: 'IT' }, { department: 'HR' }, { department: 'IT' },
      { department: '' }, { department: null }, {}, { department: 'Finance' }, { department: ',' },
    ];
    expect(distinctDepartments(employees)).toEqual(['Finance', 'HR', 'IT']);
  });

  it('merges defaults', () => {
    expect(distinctDepartments([{ department: 'IT' }], ['Sales', 'HR'])).toEqual(['HR', 'IT', 'Sales']);
  });

  it('handles a missing list', () => {
    expect(distinctDepartments(undefined)).toEqual([]);
  });
});
