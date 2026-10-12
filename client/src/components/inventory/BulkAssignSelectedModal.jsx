import React, { useMemo, useState } from 'react';
import { Search, UserPlus, FileText } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import useQuery, { errorMessageOf } from '../../hooks/useQuery';
import { EMPLOYEES_KEY, fetchEmployeesList } from '../../hooks/useEmployees';

/**
 * Assigns the selected (available company) assets to one employee. Same
 * picker as the single-asset Assign dialog: filter, pick, optional note.
 */
export default function BulkAssignSelectedModal({ isOpen, onClose, assets = [], onAssign }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign ${assets.length} asset${assets.length === 1 ? '' : 's'}`} maxWidth="max-w-lg">
      {/* Keyed body: every opening starts with an empty form. */}
      {isOpen && <AssignForm onClose={onClose} assets={assets} onAssign={onAssign} />}
    </Modal>
  );
}

function AssignForm({ onClose, assets, onAssign }) {
  const { data, loading, error } = useQuery(EMPLOYEES_KEY, fetchEmployeesList);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const employees = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => [e.name, e.email, e.department].some((v) => v && String(v).toLowerCase().includes(q)));
  }, [employees, searchTerm]);
  const selected = employees.find((e) => e.id === selectedId) || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      await onAssign(selected.id, note.trim(), selected.name);
      onClose();
    } catch {
      // The hook showed the error toast; keep the dialog open to retry.
    } finally {
      setSubmitting(false);
    }
  };

  const preview = assets.slice(0, 3).map((a) => a.name).join(', ');

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-secondary">
        {preview}{assets.length > 3 ? ` and ${assets.length - 3} more` : ''}
      </p>

      <div>
        <label htmlFor="bulk-assign-search" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
          Select Employee
        </label>
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
          <input
            id="bulk-assign-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter employees by name, email, or department..."
            className="w-full pl-9 pr-4 py-2 bg-base border border-border rounded-xl text-base sm:text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div role="radiogroup" aria-label="Employee" className="max-h-52 overflow-y-auto rounded-xl border border-border bg-base/60 divide-y divide-border/60 scrollbar-thin">
          {loading ? (
            <div className="p-4 text-center text-xs text-secondary animate-pulse">Loading employee directory...</div>
          ) : error ? (
            <div role="alert" className="p-4 text-center text-xs text-danger">{errorMessageOf(error, 'Could not load employees')}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-secondary">No matching employees found.</div>
          ) : (
            filtered.map((emp) => {
              const isSelected = emp.id === selectedId;
              return (
                <button
                  key={emp.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${emp.name}${emp.email ? `, ${emp.email}` : ''}`}
                  onClick={() => setSelectedId(emp.id)}
                  className={`w-full text-left p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-accent/20 border-l-4 border-accent' : 'hover:bg-surface'
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold truncate ${isSelected ? 'text-accent' : 'text-primary'}`}>{emp.name}</span>
                    <span className="block text-xs text-secondary mt-0.5 truncate">
                      {emp.email}{emp.department ? ` · ${emp.department}` : ''}
                    </span>
                  </span>
                  <span aria-hidden="true" className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-accent bg-accent' : 'border-border'}`}>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-on-accent" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        <label htmlFor="bulk-assign-note" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
          <span>Note (Optional)</span>
        </label>
        <textarea
          id="bulk-assign-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="E.g., Issued for the new project team."
          className="w-full rounded-xl bg-base border border-border p-3 text-base sm:text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button type="submit" loading={submitting} disabled={!selected}>
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <span>{selected ? `Assign to ${selected.name}` : 'Assign'}</span>
        </Button>
      </div>
    </form>
  );
}
