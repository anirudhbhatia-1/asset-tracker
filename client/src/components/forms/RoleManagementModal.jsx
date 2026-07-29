import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Key, Edit3, ShieldCheck, User } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'employee', label: 'Employee', description: 'Can request hardware and view own assets.' },
  { value: 'hr', label: 'HR', description: 'Can submit and track onboarding hardware requests.' },
  { value: 'admin', label: 'Admin', description: 'Full access to manage inventory, settings, and users.' },
];

export default function RoleManagementModal({ isOpen, onClose, employee, onGrantAccess, onChangeRole, onGrantGoogleAccess }) {
  const [role, setRole] = useState('employee');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    if (isOpen && employee) {
      setRole(employee.role || 'employee');
      setError('');
      setTempPassword('');
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      if (employee.hasLogin) {
        // Change role
        await onChangeRole(employee.id, role);
        onClose();
      } else {
        // Grant access
        const res = await onGrantAccess(employee.id, role);
        setTempPassword(res.temporaryPassword);
      }
    } catch (err) {
      setError(err.message || 'Failed to manage role.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!employee) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Access & Role" maxWidth="max-w-md">
      {!tempPassword ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4 p-4 rounded-xl bg-base border border-border">
            <div className="w-10 h-10 rounded-full bg-raised flex items-center justify-center text-primary font-bold">
              {employee.avatarUrl ? (
                <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span>{employee.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary">{employee.name}</h3>
              <p className="text-xs text-secondary">{employee.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>System Role</span>
            </label>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${
                    role === r.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-base hover:border-border/80'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-0.5 text-accent focus:ring-accent border-secondary bg-surface"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-primary">{r.label}</span>
                    <span className="block text-xs text-secondary mt-0.5">{r.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex flex-col gap-2">
            {!employee.hasLogin && (
              // TESTING ONLY — Grant Google Access button
              // WHEN GOING TO PRODUCTION: Remove this button entirely.
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setError('');
                  try {
                    await onGrantGoogleAccess(employee.id);
                    onClose();
                  } catch (err) {
                    setError(err.response?.data?.message || 'Failed to grant Google access');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border border-border bg-base hover:bg-raised text-secondary transition-colors"
              >
                <span>🔑</span>
                <span>Grant Google Login (Testing Only)</span>
              </button>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                {employee.hasLogin ? <Edit3 className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                <span>{employee.hasLogin ? 'Save Role Changes' : 'Grant Password Access'}</span>
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-success text-sm text-center">
            Login access granted successfully!
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              A login account has been created for <strong className="text-primary">{employee.name}</strong>. Please securely share these temporary credentials with them.
            </p>
            <div className="p-4 rounded-xl bg-base border border-border space-y-3">
              <div>
                <label className="block text-xs text-secondary mb-1">Email</label>
                <code className="text-sm font-bold text-primary">{employee.email}</code>
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Temporary Password</label>
                <code className="text-sm font-bold text-accent select-all bg-accent/10 px-2 py-1 rounded">{tempPassword}</code>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-border flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
