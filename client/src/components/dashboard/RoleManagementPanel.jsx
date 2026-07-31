import React, { useState } from 'react';
import { ShieldCheck, User, Key, ChevronDown } from 'lucide-react';

const ROLES = ['admin', 'hr', 'employee'];

const roleStyles = {
  admin: 'bg-danger/10 text-danger border-danger/30',
  hr: 'bg-warning/10 text-warning border-warning/30',
  employee: 'bg-info-blue/10 text-info-blue border-info-blue/30',
};

export default function RoleManagementPanel({ employees = [], onRoleChange }) {
  // Only show employees who have a login account
  const loginUsers = employees.filter(emp => emp.hasLogin && !emp.deletedAt);
  const [savingId, setSavingId] = useState(null);

  const handleRoleChange = async (emp, newRole) => {
    if (emp.role === newRole) return;
    setSavingId(emp.id);
    await onRoleChange(emp.id, newRole);
    setSavingId(null);
  };

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-border bg-base/50 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
          User Role Management
        </h2>
        <span className="ml-auto text-xs text-secondary px-2 py-0.5 rounded-full bg-raised border border-border">
          {loginUsers.length} active accounts
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loginUsers.length === 0 ? (
          <div className="py-12 text-center text-sm text-secondary">
            No employees have login accounts yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-base/40 border-b border-border text-xs text-secondary uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Employee</th>
                <th className="px-5 py-3 text-left font-medium">Email</th>
                <th className="px-5 py-3 text-left font-medium">Department</th>
                <th className="px-5 py-3 text-left font-medium">Current Role</th>
                <th className="px-5 py-3 text-left font-medium">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loginUsers.map(emp => (
                <tr key={emp.id} className="hover:bg-raised/20 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-raised/80 border border-border/60 flex items-center justify-center text-xs font-bold text-primary uppercase shrink-0">
                        {emp.name?.substring(0, 2) || 'U'}
                      </div>
                      <span className="font-medium text-primary truncate max-w-[140px]">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-secondary text-xs font-mono truncate max-w-[180px]">{emp.email}</td>
                  <td className="px-5 py-3 text-secondary">{emp.department || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${roleStyles[emp.role] || 'bg-base text-secondary border-border'}`}>
                      <Key className="w-2.5 h-2.5" />
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {savingId === emp.id ? (
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <select
                        value={emp.role}
                        onChange={(e) => handleRoleChange(emp, e.target.value)}
                        className="text-xs bg-base border border-border rounded-lg px-2 py-1.5 text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
