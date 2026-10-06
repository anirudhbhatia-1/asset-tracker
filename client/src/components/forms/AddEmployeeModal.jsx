import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { User, Mail, Building2, MapPin, UserPlus, Laptop } from 'lucide-react';
import useLocations from '../../hooks/useLocations';
import useRoles, { defaultRoleValue } from '../../hooks/useRoles';
import { rolePayload } from '../../api/employeesApi';
import { useAuth } from '../../context/AuthContext';
import { WORK_MODES, DEFAULT_WORK_MODE } from '../../utils/workMode';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Operations', 'HR', 'Finance', 'Marketing', 'Sales'];

export default function AddEmployeeModal({ isOpen, onClose, onAdd }) {
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
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Employee" maxWidth="max-w-md">
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
          <div className="pt-4 border-t border-border flex justify-end">
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
              {error}
            </div>
          )}

        {/* Full Name */}
        <div>
          <label htmlFor="add-emp-name" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-accent" />
            <span>Full Name <span className="text-danger">*</span></span>
          </label>
          <input
            id="add-emp-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="E.g., Priya Patel"
            className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor="add-emp-email" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-accent" />
            <span>Email Address <span className="text-danger">*</span></span>
          </label>
          <input
            id="add-emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="E.g., priya.patel@company.com"
            className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Department & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-emp-department" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-accent" />
              <span>Department</span>
            </label>
            <select
              id="add-emp-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl bg-base border border-border px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              {DEPARTMENTS.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="add-emp-location" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>Office</span>
            </label>
            <select
              id="add-emp-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl bg-base border border-border px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="">Select location...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {location && (() => {
          const selectedLoc = locations.find(l => l.name === location);
          const addrs = selectedLoc?.addresses ? (Array.isArray(selectedLoc.addresses) ? selectedLoc.addresses : JSON.parse(selectedLoc.addresses)) : [];
          if (addrs.length === 0) return null;
          return (
            <div className="mb-4">
              <label htmlFor="add-emp-address" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-accent" />
                <span>Office Address</span>
              </label>
              <select
                id="add-emp-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl bg-base border border-border px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
              >
                <option value="">Select address...</option>
                {addrs.map((addr, idx) => (
                  <option key={idx} value={addr}>
                    {addr}
                  </option>
                ))}
              </select>
            </div>
          );
        })()}

        {/* Work mode */}
        <div>
          <label htmlFor="add-emp-work-mode" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-accent" />
            <span>Work mode</span>
          </label>
          <select
            id="add-emp-work-mode"
            value={workMode}
            onChange={(e) => setWorkMode(e.target.value)}
            className="w-full rounded-xl bg-base border border-border px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
          >
            {WORK_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </div>

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
            <div className="mt-3 ml-7">
              <label htmlFor="add-emp-role" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Role
              </label>
              <select
                id="add-emp-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl bg-base border border-border px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border flex justify-end gap-3 mt-8">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            <UserPlus className="w-4 h-4" />
            <span>Add Employee Profile</span>
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}
