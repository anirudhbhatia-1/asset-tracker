import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { User, Mail, Building2, MapPin, UserPlus } from 'lucide-react';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Operations', 'HR', 'Finance', 'Marketing', 'Sales'];
const OFFICE_LOCATIONS = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];

export default function AddEmployeeModal({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [location, setLocation] = useState('Bangalore');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setDepartment('Engineering');
      setLocation('Bangalore');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and valid email address are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onAdd({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department,
        location,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add employee profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Employee Profile" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-accent" />
            <span>Full Name <span className="text-danger">*</span></span>
          </label>
          <input
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
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-accent" />
            <span>Email Address <span className="text-danger">*</span></span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="E.g., priya.patel@company.com"
            className="w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Department & Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-accent" />
              <span>Department</span>
            </label>
            <select
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
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>Office</span>
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl bg-base border border-border px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              {OFFICE_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            <UserPlus className="w-4 h-4" />
            <span>Add Employee Profile</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
