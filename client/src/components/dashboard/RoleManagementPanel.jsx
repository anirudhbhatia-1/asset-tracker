import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key } from 'lucide-react';
import api from '../../api/axiosInstance';
import { getInitials } from '../../utils/initials';
import { roleLabel } from '../../utils/roleLabel';
import Card, { CardHeader } from '../ui/Card';
import Pill from '../ui/Pill';
import { Select } from '../ui/Field';

// Role chip colours (red is kept for things that need action now).
const ROLE_TONES = {
  director: 'purple',
  admin: 'accent',
  hr: 'warning',
  employee: 'info',
};

export default function RoleManagementPanel({ employees = [], onRoleChange }) {
  const loginUsers = employees.filter(emp => emp.hasLogin && !emp.deletedAt);
  const [savingId, setSavingId] = useState(null);
  const [roles, setRoles] = useState([
    { id: 1, name: 'Director' },
    { id: 2, name: 'Admin' },
    { id: 3, name: 'HR' },
    { id: 4, name: 'Employee' }
  ]);

  useEffect(() => {
    api.get('/roles')
      .then(res => {
        if (Array.isArray(res.data?.data)) {
          setRoles(res.data.data);
        }
      })
      .catch((err) => {
        console.error('[RoleManagementPanel] Failed to fetch roles from /api/roles:', err.message);
      });
  }, []);

  const handleRoleChange = async (emp, targetRole) => {
    if (emp.role === targetRole || String(emp.roleId) === String(targetRole)) return;
    setSavingId(emp.id);
    try {
      await onRoleChange(emp.id, targetRole);
    } catch {
      // The employees hook already showed the error toast.
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={ShieldCheck}
        title="User Role Management"
        actions={<Pill size="md">{loginUsers.length} active accounts</Pill>}
      />

      {/* Table */}
      <div className="overflow-x-auto">
        {loginUsers.length === 0 ? (
          <div className="py-12 text-center text-sm text-secondary">
            No employees have login accounts yet.
          </div>
        ) : (
          <table aria-label="Employee roles" className="w-full text-sm">
            <thead className="bg-base/40 border-b border-border text-xs text-secondary uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-3 text-left font-medium">Employee</th>
                <th scope="col" className="px-5 py-3 text-left font-medium">Email</th>
                <th scope="col" className="px-5 py-3 text-left font-medium">Department</th>
                <th scope="col" className="px-5 py-3 text-left font-medium">Current Role</th>
                <th scope="col" className="px-5 py-3 text-left font-medium">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loginUsers.map(emp => (
                <tr key={emp.id} className="hover:bg-raised/20 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-raised/80 border border-border/60 flex items-center justify-center text-xs font-bold text-primary uppercase shrink-0">
                        {getInitials(emp.name)}
                      </div>
                      <span className="font-medium text-primary truncate max-w-[140px]">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-secondary text-xs font-mono truncate max-w-[180px]">{emp.email}</td>
                  <td className="px-5 py-3 text-secondary">{emp.department || '—'}</td>
                  <td className="px-5 py-3">
                    <Pill tone={ROLE_TONES[emp.role] || 'neutral'} icon={Key} className="capitalize">
                      {emp.customRoleName || roleLabel(emp)}
                    </Pill>
                  </td>
                  <td className="px-5 py-3">
                    {savingId === emp.id ? (
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Select
                        value={emp.roleId || emp.role}
                        onChange={(e) => handleRoleChange(emp, e.target.value)}
                      >
                        {roles.map(r => (
                          <option key={r.id || r.name} value={r.id || r.name.toLowerCase()}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
