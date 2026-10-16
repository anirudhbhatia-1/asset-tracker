import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Textarea } from '../ui/Field';
import { controlClass } from '../ui/fieldStyles';
import { getEmployees } from '../../api/employeesApi';
import { Search, UserPlus } from 'lucide-react';
import { todayLocalISO } from '../../utils/dates';
import { validateQuantity, parseQuantity } from '../../utils/stock';


/**
 * Give some of a bulk item to one employee. `onAssign(payload, employeeName)`
 * resolves to the updated item; the hook shows the toast.
 */
export default function StockAssignModal({ isOpen, onClose, item, onAssign }) {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [assignedDate, setAssignedDate] = useState(todayLocalISO);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const inStock = item?.inStock ?? 0;

  useEffect(() => {
    if (!isOpen) return;
    setEmployeeId('');
    setQuantity('1');
    setAssignedDate(todayLocalISO());
    setNote('');
    setSearchTerm('');
    setErrors({});

    let cancelled = false;
    setLoadingEmployees(true);
    setEmployeeLoadError(null);
    // Active directory only (removed employees are left out by default).
    getEmployees()
      .then((res) => { if (!cancelled) setEmployees(res.data?.data || (Array.isArray(res.data) ? res.data : [])); })
      .catch((err) => {
        if (cancelled) return;
        setEmployees([]);
        setEmployeeLoadError(err.response?.status === 403
          ? "You don't have permission to see the employee list. Ask an administrator for 'employees:read'."
          : 'Could not load employees.');
      })
      .finally(() => { if (!cancelled) setLoadingEmployees(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const filteredEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => [e.name, e.email, e.department].some((v) => v && v.toLowerCase().includes(q)));
  }, [employees, searchTerm]);

  const qtyNumber = parseQuantity(quantity);
  const remaining = Number.isNaN(qtyNumber) ? inStock : Math.max(inStock - qtyNumber, 0);
  const selected = employees.find((e) => String(e.id) === String(employeeId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!employeeId) next.employee = 'Choose an employee';
    const qtyError = validateQuantity(quantity, { min: 1, max: inStock });
    if (qtyError) next.quantity = inStock === 0 ? 'Nothing is in stock' : qtyError;
    if (!assignedDate) next.date = 'Choose a date';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await onAssign({
        employeeId: Number(employeeId),
        quantity: qtyNumber,
        assignedDate,
        note: note.trim() || undefined,
      }, selected?.name);
      onClose();
    } catch {
      // The hook already showed the error toast (e.g. "Only N … in stock").
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? `Assign ${item.name}` : 'Assign'}
      maxWidth="max-w-lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="stock-assign-form" variant="primary" loading={submitting} disabled={inStock === 0}>
            <UserPlus className="w-4 h-4" />
            <span>Assign</span>
          </Button>
        </>
      )}
    >
      <form id="stock-assign-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-secondary bg-base/60 border border-border/60 rounded-xl px-3.5 py-2.5" aria-live="polite">
          <strong className="text-primary">{inStock}</strong> in stock
          {!Number.isNaN(qtyNumber) && qtyNumber > 0 && qtyNumber <= inStock && (
            <> · <strong className="text-primary">{remaining}</strong> left after this</>
          )}
        </p>

        <div>
          <label htmlFor="stock-assign-search" className="block text-sm font-medium text-primary mb-1.5">
            Employee<span className="text-error" aria-hidden="true"> *</span>
          </label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
            <input
              id="stock-assign-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email or department…"
              className={`${controlClass()} pl-9`}
            />
          </div>
          <div
            role="radiogroup"
            aria-label="Employees"
            aria-describedby={errors.employee ? 'stock-assign-employee-error' : undefined}
            className="max-h-48 overflow-y-auto rounded-xl border border-border bg-base/60 divide-y divide-border/60"
          >
            {loadingEmployees ? (
              <div className="p-4 text-center text-xs text-secondary animate-pulse">Loading employees…</div>
            ) : employeeLoadError ? (
              <div role="alert" className="p-5 text-center text-xs text-error">{employeeLoadError}</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-5 text-center text-xs text-secondary">No matching employees found.</div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = String(employeeId) === String(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => { setEmployeeId(emp.id); setErrors((prev) => ({ ...prev, employee: null })); }}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-accent/15' : 'hover:bg-surface'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold truncate ${isSelected ? 'text-accent' : 'text-primary'}`}>{emp.name}</span>
                      <span className="block text-xs text-secondary truncate">
                        {emp.email}{emp.department ? ` · ${emp.department}` : ''}
                      </span>
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-accent bg-accent' : 'border-border'}`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-on-accent" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {errors.employee && <p id="stock-assign-employee-error" role="alert" className="text-xs text-error mt-1.5">{errors.employee}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="stock-assign-quantity" label="Quantity" required error={errors.quantity}>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              max={inStock}
              step="1"
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value); setErrors((prev) => ({ ...prev, quantity: null })); }}
              className="font-mono"
            />
          </Field>
          <Field id="stock-assign-date" label="Date given" error={errors.date}>
            <Input
              type="date"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
            />
          </Field>
        </div>

        <Field id="stock-assign-note" label="Note (optional)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
          />
        </Field>
      </form>
    </Modal>
  );
}
