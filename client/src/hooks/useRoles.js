import { useState, useEffect } from 'react';
import { getRoles } from '../api/employeesApi';

// Used when GET /roles fails (e.g. the viewer lacks roles:read). Values are
// role names, which the server also accepts.
const FALLBACK_ROLES = [
  { value: 'employee', name: 'Employee', description: 'View own assets & raise tickets' },
  { value: 'hr', name: 'HR', description: 'Onboarding & employee management' },
  { value: 'admin', name: 'Admin', description: 'Full system access' },
];

// Role options for pickers, including custom roles. Option values are role
// ids (as strings) when loaded from the API.
export default function useRoles(enabled = true) {
  const [roles, setRoles] = useState(FALLBACK_ROLES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    getRoles()
      .then((res) => {
        const list = res.data?.data;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setRoles(list.map((r) => ({ value: String(r.id), name: r.name, description: r.description || '' })));
        }
      })
      .catch((err) => {
        console.error('Failed to load roles, using defaults:', err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [enabled]);

  return { roles, loading };
}

// The option value matching an employee's current role, or '' if none match.
export function findRoleValue(roles, employee) {
  if (!employee) return '';
  const byId = employee.roleId != null && roles.find((r) => r.value === String(employee.roleId));
  if (byId) return byId.value;
  const name = (employee.role || '').toLowerCase();
  const byName = name && roles.find((r) => r.name.toLowerCase() === name || r.value === name);
  return byName ? byName.value : '';
}

// The default "Employee" role option value, if present.
export function defaultRoleValue(roles) {
  return roles.find((r) => r.name.toLowerCase() === 'employee')?.value || roles[0]?.value || 'employee';
}
