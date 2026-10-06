import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import useCategories from '../../hooks/useCategories';
import useLocations from '../../hooks/useLocations';
import { Package, Save } from 'lucide-react';
import {
  MAX_STOCK_QUANTITY, validateQuantity, parseQuantity, rupeesToPaise, paiseToRupeesInput,
} from '../../utils/stock';

const inputClass = 'w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5';

/**
 * Add or edit a bulk item. `item` given = edit (quantities are changed from
 * the details view, not here). `onSave(payload)` resolves to the saved item;
 * the hook shows the toast.
 */
export default function StockItemModal({ isOpen, onClose, item, onSave }) {
  const isEdit = Boolean(item);
  const { categories } = useCategories();
  const { locations, loading: locationsLoading } = useLocations(isOpen);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [cost, setCost] = useState('');
  const [threshold, setThreshold] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(item?.name || '');
    setCategoryId(item?.categoryId ? String(item.categoryId) : '');
    setLocation(item?.location || '');
    setQuantity('0');
    setCost(paiseToRupeesInput(item?.costCents));
    setThreshold(item?.lowStockThreshold === null || item?.lowStockThreshold === undefined ? '' : String(item.lowStockThreshold));
    setNotes(item?.notes || '');
    setErrors({});
  }, [isOpen, item]);

  // No locations to pick from (none set up, or no access): type it instead.
  const useLocationText = !locationsLoading && locations.length === 0;
  const locationInList = !location || locations.some((l) => l.name === location);

  const clearError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Name is required';
    if (!isEdit) {
      const qtyError = validateQuantity(quantity, { min: 0, label: 'Starting quantity' });
      if (qtyError) next.quantity = qtyError;
    }
    if (Number.isNaN(rupeesToPaise(cost))) next.cost = 'Enter an amount like 450 or 450.50';
    if (threshold.trim() !== '') {
      const thresholdError = validateQuantity(threshold, { min: 0, label: 'Warning level' });
      if (thresholdError) next.threshold = thresholdError;
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      name: name.trim(),
      categoryId: categoryId ? Number(categoryId) : null,
      location: location.trim() || null,
      costCents: rupeesToPaise(cost),
      lowStockThreshold: threshold.trim() === '' ? null : parseQuantity(threshold),
      notes: notes.trim() || null,
    };
    if (!isEdit) payload.quantity = parseQuantity(quantity);
    if (isEdit) {
      // Send only what changed, so the history names the edited fields.
      Object.keys(payload).forEach((key) => {
        if ((payload[key] ?? null) === (item[key] ?? null)) delete payload[key];
      });
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } catch {
      // The hook already showed the error toast.
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key) => errors[key] && (
    <p id={`stock-item-${key}-error`} role="alert" className="text-xs text-danger mt-1.5">{errors[key]}</p>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${item.name}` : 'Add bulk item'} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!isEdit && (
          <p className="text-xs text-secondary bg-base/60 border border-border/60 rounded-xl p-3 flex items-start gap-2">
            <Package className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <span>For items without serial numbers, like bags or cables. They are kept as one record with a count.</span>
          </p>
        )}

        <div>
          <label htmlFor="stock-item-name" className={labelClass}>Name <span className="text-danger">*</span></label>
          <input
            id="stock-item-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError('name'); }}
            maxLength={150}
            placeholder="E.g., Laptop Bag"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'stock-item-name-error' : undefined}
            className={inputClass}
          />
          {fieldError('name')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="stock-item-category" className={labelClass}>Category</label>
            <select
              id="stock-item-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="stock-item-location" className={labelClass}>Location</label>
            {useLocationText ? (
              <input
                id="stock-item-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                placeholder="E.g., Bengaluru"
                className={inputClass}
              />
            ) : (
              <select
                id="stock-item-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">No location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
                {!locationInList && <option value={location}>{location} (current)</option>}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!isEdit && (
            <div>
              <label htmlFor="stock-item-quantity" className={labelClass}>Starting quantity <span className="text-danger">*</span></label>
              <input
                id="stock-item-quantity"
                type="number"
                inputMode="numeric"
                min="0"
                max={MAX_STOCK_QUANTITY}
                step="1"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); clearError('quantity'); }}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={errors.quantity ? 'stock-item-quantity-error' : undefined}
                className={`${inputClass} font-mono`}
              />
              {fieldError('quantity')}
            </div>
          )}

          <div>
            <label htmlFor="stock-item-cost" className={labelClass}>Cost per unit (₹)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary font-medium" aria-hidden="true">₹</span>
              <input
                id="stock-item-cost"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => { setCost(e.target.value); clearError('cost'); }}
                placeholder="450.00"
                aria-invalid={Boolean(errors.cost)}
                aria-describedby={errors.cost ? 'stock-item-cost-error' : undefined}
                className={`${inputClass} pl-8 font-mono`}
              />
            </div>
            {fieldError('cost')}
          </div>
        </div>

        <div>
          <label htmlFor="stock-item-threshold" className={labelClass}>Warn when stock is at or below</label>
          <input
            id="stock-item-threshold"
            type="number"
            inputMode="numeric"
            min="0"
            max={MAX_STOCK_QUANTITY}
            step="1"
            value={threshold}
            onChange={(e) => { setThreshold(e.target.value); clearError('threshold'); }}
            placeholder="Leave blank for no warning"
            aria-invalid={Boolean(errors.threshold)}
            aria-describedby={errors.threshold ? 'stock-item-threshold-error' : 'stock-item-threshold-hint'}
            className={`${inputClass} font-mono`}
          />
          {errors.threshold
            ? fieldError('threshold')
            : <p id="stock-item-threshold-hint" className="text-xs text-secondary mt-1.5">Shows a "Low stock" badge when this few are left on the shelf.</p>}
        </div>

        <div>
          <label htmlFor="stock-item-notes" className={labelClass}>Notes</label>
          <textarea
            id="stock-item-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Supplier, size, colour…"
            className={inputClass}
          />
        </div>

        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            <Save className="w-4 h-4" />
            <span>{isEdit ? 'Save changes' : 'Add bulk item'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
