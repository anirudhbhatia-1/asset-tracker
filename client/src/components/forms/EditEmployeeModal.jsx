import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { getLocations } from '../../api/locationsApi';
import { getEmployees } from '../../api/employeesApi';
import { useAuth } from '../../context/AuthContext';
import useRoles, { findRoleValue } from '../../hooks/useRoles';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select } from '../ui/Field';
import { WORK_MODES, normalizeWorkMode } from '../../utils/workMode';

export default function EditEmployeeModal({ isOpen, employee, onClose, onSave, onChangeRole }) {
  const { hasPermission } = useAuth();
  // Role changes go through PATCH /employees/:id/role, which needs roles:manage.
  const canEditRole = hasPermission('roles:manage') && Boolean(onChangeRole);
  const { roles } = useRoles(isOpen && canEditRole);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [workMode, setWorkMode] = useState(normalizeWorkMode());
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // DB data
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);

  // Pre-fill when employee changes
  useEffect(() => {
    if (employee) {
      setName(employee.name || '');
      setDepartment(employee.department || '');
      setLocation(employee.location || '');
      setAddress(employee.address || '');
      setWorkMode(normalizeWorkMode(employee.workMode));
    }
  }, [employee]);

  const initialRole = findRoleValue(roles, employee);
  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  // Reset address when location changes (unless it's the initial load)
  const handleLocationChange = (newLocation) => {
    setLocation(newLocation);
    setAddress(''); // Reset address when location changes
  };

  // Load locations and departments from DB when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoadingContext(true);
      try {
        // Load locations from the locations table
        const locRes = await getLocations();
        setLocations(locRes.data?.data || []);

        // Load departments from existing employees (distinct values)
        const empRes = await getEmployees();
        const emps = empRes.data?.data || empRes.data || [];
        const deps = [...new Set(emps.map(e => e.department).filter(Boolean))].sort();
        setDepartments(deps);
      } catch (err) {
        console.error('Failed to load modal context:', err);
        // Non-fatal — user can still type manually in text input fallback
      } finally {
        setLoadingContext(false);
      }
    };
    load();
  }, [isOpen]);

  if (!isOpen || !employee) return null;

  // Get addresses for the currently selected location
  const selectedLocationObj = locations.find(l => l.name === location);
  const availableAddresses = selectedLocationObj?.addresses
    ? (Array.isArray(selectedLocationObj.addresses)
        ? selectedLocationObj.addresses
        : (() => { try { return JSON.parse(selectedLocationObj.addresses); } catch { return []; } })())
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        department: department.trim() || null,
        location: location.trim() || null,
        address: address.trim() || null,
        workMode,
      };

      // The profile PATCH ignores role; change it separately, and only when
      // it actually changed and the employee already has a login account.
      await onSave(employee.id, payload);
      if (canEditRole && employee.hasLogin && role && role !== initialRole) {
        // The details save already toasted; don't add a second success toast.
        await onChangeRole(employee.id, role, { quiet: true });
      }
      onClose();
    } catch {
      // Error shown by hook via toast
    } finally {
      setSubmitting(false);
    }
  };

  // Group/read-only labels styled like the Field labels.
  const labelClass = "block text-sm font-medium text-primary mb-1.5";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Employee Details"
      headerExtra={<p className="w-full text-xs text-secondary">Changes are saved to the database immediately.</p>}
      maxWidth="max-w-lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-employee-form"
            loading={submitting}
            disabled={!name.trim() || loadingContext}
          >
            Save Changes
          </Button>
        </>
      )}
    >
      {loadingContext ? (
        <div className="py-12 flex flex-col items-center gap-3 text-secondary">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          <p className="text-sm">Loading location & department data…</p>
        </div>
      ) : (
        <form id="edit-employee-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Read-only email */}
          <div>
            <span className={labelClass}>Email (read-only)</span>
            <p className="text-sm text-secondary font-mono bg-base/60 px-3 py-2 rounded-lg border border-border/60 truncate">
              {employee.email}
            </p>
          </div>

          <Field id="edit-emp-name" label="Full Name" required>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </Field>

          {/* Department — Dropdown from DB + "Other" text fallback */}
          <div>
            <Field id="edit-emp-department" label="Department">
              <Select
                value={department}
                onChange={e => setDepartment(e.target.value)}
              >
                <option value="">— Not assigned —</option>
                {departments.map(dep => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
                {/* If current value isn't in the list, still show it */}
                {department && !departments.includes(department) && (
                  <option value={department}>{department} (current)</option>
                )}
                <option value="__custom__">+ Add new department…</option>
              </Select>
            </Field>
            {/* Show text input if user picked "custom" */}
            {department === '__custom__' && (
              <Input
                type="text"
                autoFocus
                aria-label="New department name"
                placeholder="Type department name…"
                onChange={e => setDepartment(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Location — Dropdown from locations table */}
          <Field id="edit-emp-location" label="Office Location">
            <Select
              value={location}
              onChange={e => handleLocationChange(e.target.value)}
            >
              <option value="">— Not assigned —</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
              {/* If current value isn't in the list, still show it */}
              {location && !locations.find(l => l.name === location) && (
                <option value={location}>{location} (current)</option>
              )}
            </Select>
          </Field>

          {/* Address — Cascades from selected location's addresses (from DB) */}
          {location && availableAddresses.length > 0 && (
            <div>
              <Field id="edit-emp-address" label="Office Address">
                <Select
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                >
                  <option value="">— Select address —</option>
                  {availableAddresses.map((addr, i) => (
                    <option key={i} value={addr}>{addr}</option>
                  ))}
                </Select>
              </Field>
              {address && (
                <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {address}
                </p>
              )}
            </div>
          )}

          <Field id="edit-emp-work-mode" label="Work mode">
            <Select
              value={workMode}
              onChange={e => setWorkMode(e.target.value)}
            >
              {WORK_MODES.map(mode => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </Select>
          </Field>

          {/* Role — only shown if the employee already has a login account */}
          {employee.hasLogin && canEditRole && (
            <div>
              <span className={labelClass}>System Role</span>
              <div className="space-y-2">
                {roles.map(r => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      role === r.value
                        ? 'border-accent bg-accent/8'
                        : 'border-border bg-base/60 hover:bg-raised/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="accent-accent"
                    />
                    <div>
                      <div className={`text-sm font-medium ${role === r.value ? 'text-accent' : 'text-primary'}`}>
                        {r.name}
                      </div>
                      {r.description && <div className="text-xs text-secondary">{r.description}</div>}
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-warning mt-2 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                Changing role takes effect on next login.
              </p>
            </div>
          )}

          {employee.hasLogin && !canEditRole && (
            <div>
              <span className={labelClass}>System Role</span>
              <div className="p-3 bg-base/60 rounded-lg border border-border/60 text-xs text-secondary flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Role changes require role-management access.</span>
              </div>
            </div>
          )}

          {/* If no login — show info */}
          {!employee.hasLogin && (
            <div className="p-3 bg-base/60 rounded-lg border border-border/60 text-xs text-secondary flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>This employee doesn't have a login account yet. Use "Manage Role" on the card to grant access first.</span>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
