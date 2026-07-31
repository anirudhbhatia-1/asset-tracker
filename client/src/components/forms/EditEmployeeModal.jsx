import React, { useState, useEffect } from 'react';
import { X, Loader2, Building2, MapPin, ShieldCheck, User } from 'lucide-react';
import { getLocations } from '../../api/locationsApi';
import { getEmployees } from '../../api/employeesApi';

const ROLES = [
  { value: 'admin', label: 'Admin', desc: 'Full system access' },
  { value: 'hr', label: 'HR Partner', desc: 'Onboarding & employee management' },
  { value: 'employee', label: 'Employee', desc: 'View own assets & raise tickets' },
];

export default function EditEmployeeModal({ isOpen, employee, onClose, onSave }) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
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
      setRole(employee.role || '');
    }
  }, [employee]);

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
      };

      // Only send role if the employee already has a login account
      if (employee.hasLogin && role) {
        payload.role = role;
      }

      await onSave(employee.id, payload);
      onClose();
    } catch (err) {
      // Error shown by hook via toast
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-base/50 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-primary">Edit Employee Details</h2>
            <p className="text-xs text-secondary mt-0.5">Changes are saved to the database immediately.</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto flex-1">
          {loadingContext ? (
            <div className="py-12 flex flex-col items-center gap-3 text-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-sm">Loading location & department data...</p>
            </div>
          ) : (
            <form id="edit-employee-form" onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Read-only email */}
              <div className="space-y-1">
                <label className={labelClass}>
                  <User className="w-3.5 h-3.5" /> Email (read-only)
                </label>
                <p className="text-sm text-secondary font-mono bg-base/60 px-3 py-2.5 rounded-lg border border-border/60 truncate">
                  {employee.email}
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className={labelClass}>
                  <User className="w-3.5 h-3.5" /> Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Department — Dropdown from DB + "Other" text fallback */}
              <div>
                <label className={labelClass}>
                  <Building2 className="w-3.5 h-3.5" /> Department
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Not assigned —</option>
                  {departments.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                  {/* If current value isn't in the list, still show it */}
                  {department && !departments.includes(department) && (
                    <option value={department}>{department} (current)</option>
                  )}
                  <option value="__custom__">+ Add new department...</option>
                </select>
                {/* Show text input if user picked "custom" */}
                {department === '__custom__' && (
                  <input
                    type="text"
                    autoFocus
                    placeholder="Type department name..."
                    onChange={e => setDepartment(e.target.value)}
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>

              {/* Location — Dropdown from locations table */}
              <div>
                <label className={labelClass}>
                  <MapPin className="w-3.5 h-3.5" /> Office Location
                </label>
                <select
                  value={location}
                  onChange={e => handleLocationChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Not assigned —</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                  {/* If current value isn't in the list, still show it */}
                  {location && !locations.find(l => l.name === location) && (
                    <option value={location}>{location} (current)</option>
                  )}
                </select>
              </div>

              {/* Address — Cascades from selected location's addresses (from DB) */}
              {location && availableAddresses.length > 0 && (
                <div>
                  <label className={labelClass}>
                    <MapPin className="w-3.5 h-3.5 text-secondary" /> Office Address
                  </label>
                  <select
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Select address —</option>
                    {availableAddresses.map((addr, i) => (
                      <option key={i} value={addr}>{addr}</option>
                    ))}
                  </select>
                  {address && (
                    <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {address}
                    </p>
                  )}
                </div>
              )}

              {/* Role — only shown if the employee already has a login account */}
              {employee.hasLogin && (
                <div>
                  <label className={labelClass}>
                    <ShieldCheck className="w-3.5 h-3.5" /> System Role
                  </label>
                  <div className="space-y-2">
                    {ROLES.map(r => (
                      <label
                        key={r.value}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
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
                            {r.label}
                          </div>
                          <div className="text-xs text-secondary">{r.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-warning mt-2 flex items-start gap-1">
                    ⚠️ Changing role takes effect on next login.
                  </p>
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
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-base/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            form="edit-employee-form"
            type="submit"
            disabled={submitting || !name.trim() || loadingContext}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
