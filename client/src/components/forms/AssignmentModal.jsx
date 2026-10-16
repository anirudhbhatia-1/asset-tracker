import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Pill from '../ui/Pill';
import Field, { Input, Textarea } from '../ui/Field';
import { controlClass } from '../ui/fieldStyles';
import { getEmployees } from '../../api/employeesApi';
import { Search, Calendar, UserPlus, FileText } from 'lucide-react';
import { todayLocalISO } from '../../utils/dates';

export default function AssignmentModal({ isOpen, onClose, onAssign, asset }) {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(asset?.assignedTo || '');
  const [assignedDate, setAssignedDate] = useState(todayLocalISO);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedEmployeeId(asset?.assignedTo || '');
    setAssignedDate(todayLocalISO());
    setNote('');
    setSearchTerm('');

    const fetchEmps = async () => {
      setLoadingEmployees(true);
      try {
        const res = await getEmployees();
        setEmployees(res.data?.data || (Array.isArray(res.data) ? res.data : []));
      } catch {
        // Leave the list empty; the modal shows its empty state.
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmps();
  }, [isOpen, asset]);

  const filteredEmployees = useMemo(() => {
    const safeEmployees = Array.isArray(employees) ? employees : [];
    if (!searchTerm.trim()) return safeEmployees;
    const q = searchTerm.toLowerCase();
    return safeEmployees.filter(
      (e) => (e.name && e.name.toLowerCase().includes(q)) || (e.email && e.email.toLowerCase().includes(q)) || (e.department && e.department.toLowerCase().includes(q))
    );
  }, [employees, searchTerm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;

    setSubmitting(true);
    try {
      await onAssign(Number(selectedEmployeeId), assignedDate, note.trim());
      onClose();
    } catch {
      // Error handled in parent hook with toast
    } finally {
      setSubmitting(false);
    }
  };

  const isReassign = asset?.status === 'in-use' && asset?.assignedTo;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReassign ? `Reassign Asset: ${asset?.name}` : `Assign Asset: ${asset?.name}`}
      maxWidth="max-w-lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="assignment-form"
            variant="primary"
            loading={submitting}
            disabled={!selectedEmployeeId}
          >
            <UserPlus className="w-4 h-4" />
            <span>{isReassign ? 'Reassign Hardware' : 'Assign Hardware'}</span>
          </Button>
        </>
      )}
    >
      <form id="assignment-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Searchable Employee List */}
        <div>
          <label htmlFor="assign-employee-search" className="block text-sm font-medium text-primary mb-1.5">
            Select Employee
          </label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              id="assign-employee-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter employees by name, email, or department…"
              className={`${controlClass()} pl-9 pr-4`}
            />
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-base/60 divide-y divide-border/60 scrollbar-thin">
            {loadingEmployees ? (
              <div className="p-4 text-center text-xs text-secondary animate-pulse">Loading employee directory…</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-6 text-center text-xs text-secondary">No matching employees found.</div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = Number(selectedEmployeeId) === Number(emp.id);
                const isCurrent = Number(asset?.assignedTo) === Number(emp.id);

                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`w-full text-left p-3 flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-accent/20 border-l-4 border-accent' : 'hover:bg-surface'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isSelected ? 'text-accent' : 'text-primary'}`}>
                          {emp.name}
                        </span>
                        {isCurrent && (
                          <Pill tone="info" className="uppercase">
                            Current Assignee
                          </Pill>
                        )}
                      </div>
                      <span className="text-xs text-secondary block mt-0.5">
                        {emp.email} {emp.department ? `· ${emp.department}` : ''}
                      </span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-accent bg-accent' : 'border-border'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-on-accent" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Assignment Date */}
        <Field
          id="assign-date"
          label={(
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Effective Assignment Date</span>
            </span>
          )}
        >
          <Input
            type="date"
            value={assignedDate}
            onChange={(e) => setAssignedDate(e.target.value)}
            required
          />
        </Field>

        {/* Optional Notes */}
        <Field
          id="assign-note"
          label={(
            <span className="inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-accent" />
              <span>Assignment Notes (Optional)</span>
            </span>
          )}
        >
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="E.g., Issued with laptop charger, external keyboard, and carry case."
            rows={2}
          />
        </Field>
      </form>
    </Modal>
  );
}
