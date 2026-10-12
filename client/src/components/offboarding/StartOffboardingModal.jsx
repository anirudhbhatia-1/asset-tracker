import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { X, Loader2, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEmployees } from '../../api/employeesApi';
import useFocusTrap from '../../hooks/useFocusTrap';
import { getExistingOffboardingId } from '../../hooks/useOffboarding';
import { todayLocalISO } from '../../utils/dates';
import { OFFBOARDING_REASONS, getOffboardableEmployees } from '../../utils/offboarding';

const inputClass = 'w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

/**
 * Starts an exit for an employee. `onSubmit` is the hook's createRequest
 * (it shows the toasts). `preselectedEmployee` fixes the employee (Employees
 * page). On success `onCreated(request)` runs; when the employee already has
 * an open exit, `onOpenExisting(requestId)` lets the parent open that one.
 */
const StartOffboardingModal = ({ isOpen, onClose, onSubmit, onCreated, onOpenExisting, preselectedEmployee = null }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [revokeAccess, setRevokeAccess] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // { requestId } when the server says this employee already has an open exit
  const [existing, setExisting] = useState(null);

  const preselectedId = preselectedEmployee?.id;

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setEmployeeId('');
      setLastWorkingDate('');
      setReason('');
      setNotes('');
      setRevokeAccess(true);
      setExisting(null);
      setLoadError(null);
      return;
    }
    setLastWorkingDate(todayLocalISO());
    setEmployeeId(preselectedId ? String(preselectedId) : '');
    if (preselectedId) return;

    let cancelled = false;
    setLoadingEmployees(true);
    getEmployees()
      .then(res => {
        if (cancelled) return;
        const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setEmployees(Array.isArray(list) ? list : []);
      })
      .catch(err => {
        if (!cancelled) setLoadError(err.response?.data?.message || 'Could not load employees');
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployees(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, preselectedId]);

  const actorIsDirector = Boolean(user?.isDirector || user?.role === 'director');
  const candidates = useMemo(
    () => getOffboardableEmployees(employees, user?.id, { actorIsDirector })
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [employees, user?.id, actorIsDirector]
  );

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(emp => (
      (emp.name && emp.name.toLowerCase().includes(q))
      || (emp.email && emp.email.toLowerCase().includes(q))
      || (emp.department && emp.department.toLowerCase().includes(q))
    ));
  }, [candidates, search]);

  // Keep the chosen employee in the list while a search hides them.
  const selectedCandidate = candidates.find(emp => String(emp.id) === employeeId);
  const options = selectedCandidate && !filteredCandidates.includes(selectedCandidate)
    ? [selectedCandidate, ...filteredCandidates]
    : filteredCandidates;

  const selectedEmployee = preselectedEmployee || selectedCandidate || null;
  // Without a login there is nothing to revoke; the server ignores the flag.
  const showRevoke = !selectedEmployee || selectedEmployee.hasLogin !== false;

  const dialogRef = useRef(null);
  const titleId = useId();
  const idPrefix = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen, submitting ? undefined : onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !lastWorkingDate) return;
    setSubmitting(true);
    setExisting(null);
    try {
      const created = await onSubmit({
        employeeId: Number(employeeId),
        lastWorkingDate,
        reason: reason || undefined,
        notes: notes.trim() || undefined,
        revokeAccess,
      });
      onClose();
      if (created && onCreated) onCreated(created);
    } catch (err) {
      const requestId = getExistingOffboardingId(err);
      if (requestId) setExisting({ requestId });
      // Other errors were shown as a toast by the hook.
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenExisting = () => {
    const requestId = existing?.requestId;
    onClose();
    if (requestId && onOpenExisting) onOpenExisting(requestId);
  };

  const field = (name) => `${idPrefix}-${name}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-base/75 backdrop-blur-sm animate-fadeIn" onClick={submitting ? undefined : onClose} />

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90dvh] animate-scaleUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-primary">Start Offboarding</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={submitting} className="p-2.5 sm:p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="offboarding-start-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Employee */}
            {preselectedEmployee ? (
              <div className="space-y-1">
                <span className="text-sm font-medium text-primary">Employee</span>
                <div className="px-3 py-2 bg-base border border-border rounded-lg">
                  <div className="text-sm font-medium text-primary">{preselectedEmployee.name}</div>
                  <div className="text-xs text-secondary">
                    {preselectedEmployee.email}{preselectedEmployee.department ? ` · ${preselectedEmployee.department}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor={field('employee')} className="text-sm font-medium text-primary">Employee <span className="text-error">*</span></label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search employees"
                    placeholder="Search by name, email or department..."
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <select
                  id={field('employee')}
                  required
                  value={employeeId}
                  onChange={(e) => { setEmployeeId(e.target.value); setExisting(null); }}
                  disabled={loadingEmployees}
                  className={inputClass}
                >
                  <option value="">
                    {loadingEmployees ? 'Loading employees...' : (options.length ? 'Select an employee...' : 'No matching employees')}
                  </option>
                  {options.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email}){emp.department ? ` · ${emp.department}` : ''}
                    </option>
                  ))}
                </select>
                {loadError && (
                  <p role="alert" className="text-xs text-error">{loadError}</p>
                )}
                {!loadingEmployees && !loadError && (
                  <p className="text-xs text-secondary">Employees who already have an exit in progress are not listed.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor={field('date')} className="text-sm font-medium text-primary">Last working day <span className="text-error">*</span></label>
                <input
                  id={field('date')}
                  type="date"
                  required
                  value={lastWorkingDate}
                  onChange={(e) => setLastWorkingDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={field('reason')} className="text-sm font-medium text-primary">Reason</label>
                <select
                  id={field('reason')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Not specified</option>
                  {OFFBOARDING_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor={field('notes')} className="text-sm font-medium text-primary">Notes</label>
              <textarea
                id={field('notes')}
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Handover details, collection arrangements..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {showRevoke && (
              <div className="flex items-start gap-3">
                <input
                  id={field('revoke')}
                  type="checkbox"
                  checked={revokeAccess}
                  onChange={(e) => setRevokeAccess(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-accent border-border focus:ring-accent cursor-pointer"
                />
                <label htmlFor={field('revoke')} className="text-sm text-primary cursor-pointer">
                  Revoke login access when completed
                  <span className="block text-xs text-secondary mt-0.5">They keep signing in until the offboarding is completed.</span>
                </label>
              </div>
            )}

            {existing && (
              <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 bg-warning/10 border border-warning/20 text-warning rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>This employee already has an offboarding in progress.</span>
                </div>
                {onOpenExisting && (
                  <button
                    type="button"
                    onClick={handleOpenExisting}
                    className="px-3 py-1.5 border border-warning/40 text-warning hover:bg-warning/10 text-xs font-medium rounded-md transition-colors shrink-0"
                  >
                    Open existing
                  </button>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 px-6 py-4 border-t border-border bg-base/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            form="offboarding-start-form"
            type="submit"
            disabled={submitting || !employeeId || !lastWorkingDate}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Start Offboarding
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartOffboardingModal;
