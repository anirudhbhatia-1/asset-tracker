import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select } from '../ui/Field';
import { UserPlus } from 'lucide-react';
import useLocations from '../../hooks/useLocations';
import useRoles, { defaultRoleValue } from '../../hooks/useRoles';
import { rolePayload } from '../../api/employeesApi';
import { useAuth } from '../../context/AuthContext';
import { WORK_MODES, DEFAULT_WORK_MODE } from '../../utils/workMode';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Operations', 'HR', 'IT', 'Finance', 'Marketing', 'Sales'];

// `departments`: names already used in the directory, offered alongside the defaults.
export default function AddEmployeeModal({ isOpen, onClose, onAdd, departments = [] }) {
  const departmentOptions = useMemo(
    () => [...new Set([...DEPARTMENTS, ...departments.filter(Boolean)])].sort((a, b) => a.localeCompare(b)),
    [departments],
  );
  const { locations } = useLocations(isOpen);
  const { hasPermission } = useAuth();
  const canGrantAccess = hasPermission('employees:grant-access');
  const { roles } = useRoles(isOpen && canGrantAccess);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [workMode, setWorkMode] = useState(DEFAULT_WORK_MODE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [grantAccess, setGrantAccess] = useState(false);
  const [role, setRole] = useState('employee');
  const [temporaryPassword, setTemporaryPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setDepartment('');
      setLocation('');
      setAddress('');
      setWorkMode(DEFAULT_WORK_MODE);
      setError('');
      setGrantAccess(false);
      setTemporaryPassword('');
    }
  }, [isOpen]);

  // Default to the Employee role once the role list is known.
  useEffect(() => {
    if (isOpen) setRole(defaultRoleValue(roles));
  }, [isOpen, roles]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and valid email address are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await onAdd({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department,
        location,
        address,
        workMode,
        grantAccess,
        ...(grantAccess ? rolePayload(role) : {}),
      });
      
      // If a temp password came back, show it instead of closing
      if (result?.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to add employee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Employee"
      maxWidth="max-w-md"
      footer={temporaryPassword ? (
        <Button variant="primary" onClick={onClose}>Done</Button>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="add-employee-form" variant="primary" loading={submitting}>
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Add Employee Profile</span>
          </Button>
        </>
      )}
    >
      {temporaryPassword ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-success text-sm text-center">
            Employee created with login access!
          </div>
          <p className="text-sm text-secondary">
            Share these credentials securely with <strong className="text-primary">{name}</strong>.
          </p>
          <div className="p-4 rounded-xl bg-base border border-border space-y-3">
            <div>
              <span className="block text-xs text-secondary mb-1">Email</span>
              <code className="text-sm font-bold text-primary">{email.trim().toLowerCase()}</code>
            </div>
            <div>
              <span className="block text-xs text-secondary mb-1">Temporary Password</span>
              <code className="text-sm font-bold text-accent select-all bg-accent/10 px-2 py-1 rounded">{temporaryPassword}</code>
            </div>
          </div>
        </div>
      ) : (
        <form id="add-employee-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
              {error}
            </div>
          )}

          <Field id="add-emp-name" label="Full Name" required>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E.g., Priya Patel"
            />
          </Field>

          <Field id="add-emp-email" label="Email Address" required>
            <Input
              type="email"
                autoComplete="off"
                spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E.g., priya.patel@company.com"
            />
          </Field>

          {/* Department & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="add-emp-department" label="Department">
              <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">Select department</option>
                {departmentOptions.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </Select>
            </Field>

            <Field id="add-emp-location" label="Office">
              <Select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">Select location…</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {location && (() => {
            const selectedLoc = locations.find(l => l.name === location);
            const addrs = selectedLoc?.addresses ? (Array.isArray(selectedLoc.addresses) ? selectedLoc.addresses : JSON.parse(selectedLoc.addresses)) : [];
            if (addrs.length === 0) return null;
            return (
              <Field id="add-emp-address" label="Office Address" className="mb-4">
                <Select value={address} onChange={(e) => setAddress(e.target.value)}>
                  <option value="">Select address…</option>
                  {addrs.map((addr, idx) => (
                    <option key={idx} value={addr}>
                      {addr}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          })()}

          <Field id="add-emp-work-mode" label="Work mode">
            <Select value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
              {WORK_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </Select>
          </Field>

          {/* Grant Login Access Toggle */}
          {canGrantAccess && (
          <div className="pt-2 border-t border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={grantAccess}
                onChange={(e) => setGrantAccess(e.target.checked)}
                className="w-4 h-4 rounded text-accent border-border focus:ring-accent"
              />
              <span className="text-sm font-medium text-primary">Also create a login account</span>
            </label>
            {grantAccess && (
              <Field id="add-emp-role" label="Role" className="mt-3 ml-7">
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>{r.name}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          )}
        </form>
      )}
    </Modal>
  );
}
