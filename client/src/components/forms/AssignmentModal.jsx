import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { getEmployees } from '../../api/employeesApi';
import { Search, Calendar, UserPlus, FileText } from 'lucide-react';

export default function AssignmentModal({ isOpen, onClose, onAssign, asset }) {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(asset?.assignedTo || '');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedEmployeeId(asset?.assignedTo || '');
    setAssignedDate(new Date().toISOString().substring(0, 10));
    setNote('');
    setSearchTerm('');

    const fetchEmps = async () => {
      setLoadingEmployees(true);
      try {
        const res = await getEmployees();
        setEmployees(res.data || []);
      } catch (err) {
        // Handle error safely
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmps();
  }, [isOpen, asset]);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const q = searchTerm.toLowerCase();
    return employees.filter(
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
    } catch (err) {
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
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Searchable Employee List */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Select Employee
          </label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter employees by name, email, or department..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/60 divide-y divide-slate-700/60 scrollbar-thin">
            {loadingEmployees ? (
              <div className="p-4 text-center text-xs text-slate-400 animate-pulse">Loading employee directory...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No matching employees found.</div>
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
                      isSelected ? 'bg-indigo-600/20 border-l-4 border-indigo-500' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                          {emp.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                            Current Assignee
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        {emp.email} {emp.department ? `· ${emp.department}` : ''}
                      </span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-indigo-500 bg-indigo-600' : 'border-slate-600'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Assignment Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>Effective Assignment Date</span>
          </label>
          <input
            type="date"
            value={assignedDate}
            onChange={(e) => setAssignedDate(e.target.value)}
            required
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Assignment Notes (Optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="E.g., Issued with laptop charger, external keyboard, and carry case."
            rows={2}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-700 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!selectedEmployeeId}
          >
            <UserPlus className="w-4 h-4" />
            <span>{isReassign ? 'Reassign Hardware' : 'Assign Hardware'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
