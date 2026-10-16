import React, { useState, useEffect, useId, useMemo } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEmployees } from '../../api/employeesApi';
import { getExistingOffboardingId } from '../../hooks/useOffboarding';
import { todayLocalISO } from '../../utils/dates';
import { OFFBOARDING_REASONS, getOffboardableEmployees } from '../../utils/offboarding';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';
import { controlClass } from '../ui/fieldStyles';

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

  const idPrefix = useId();

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
    <Modal
      isOpen={isOpen}
      // Can't be closed while the request is being sent.
      onClose={submitting ? () => {} : onClose}
      title="Start Offboarding"
      maxWidth="max-w-xl"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="offboarding-start-form"
            loading={submitting}
            disabled={!employeeId || !lastWorkingDate}
          >
            Start Offboarding
          </Button>
        </>
      )}
    >
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
            <label htmlFor={field('employee')} className="block text-sm font-medium text-primary">Employee <span className="text-error" aria-hidden="true">*</span></label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search employees"
                placeholder="Search by name, email or department..."
                className={`${controlClass()} pl-9`}
              />
            </div>
            <Select
              id={field('employee')}
              required
              value={employeeId}
              onChange={(e) => { setEmployeeId(e.target.value); setExisting(null); }}
              disabled={loadingEmployees}
            >
              <option value="">
                {loadingEmployees ? 'Loading employees...' : (options.length ? 'Select an employee...' : 'No matching employees')}
              </option>
              {options.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email}){emp.department ? ` · ${emp.department}` : ''}
                </option>
              ))}
            </Select>
            {loadError && (
              <p role="alert" className="text-xs text-error">{loadError}</p>
            )}
            {!loadingEmployees && !loadError && (
              <p className="text-xs text-secondary">Employees who already have an exit in progress are not listed.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id={field('date')} label="Last working day" required>
            <Input
              type="date"
              value={lastWorkingDate}
              onChange={(e) => setLastWorkingDate(e.target.value)}
            />
          </Field>
          <Field id={field('reason')} label="Reason">
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Not specified</option>
              {OFFBOARDING_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field id={field('notes')} label="Notes">
          <Textarea
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Handover details, collection arrangements..."
          />
        </Field>

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
              <Button variant="secondary" size="sm" onClick={handleOpenExisting}>
                Open existing
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default StartOffboardingModal;
