import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';
import { controlClass } from '../ui/fieldStyles';
import useCategories from '../../hooks/useCategories';
import useLocations from '../../hooks/useLocations';
import { Package, Save } from 'lucide-react';
import {
  MAX_STOCK_QUANTITY, validateQuantity, parseQuantity, rupeesToPaise, paiseToRupeesInput,
} from '../../utils/stock';


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
  const [purchaseDate, setPurchaseDate] = useState('');
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
    setPurchaseDate(item?.purchaseDate || '');
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
      purchaseDate: purchaseDate || null,
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
    <p id={`stock-item-${key}-error`} role="alert" className="text-xs text-error">{errors[key]}</p>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit ${item.name}` : 'Add bulk item'}
      maxWidth="max-w-lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="stock-item-form" variant="primary" loading={submitting}>
            <Save className="w-4 h-4" />
            <span>{isEdit ? 'Save changes' : 'Add bulk item'}</span>
          </Button>
        </>
      )}
    >
      <form id="stock-item-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!isEdit && (
          <p className="text-xs text-secondary bg-base/60 border border-border/60 rounded-xl p-3 flex items-start gap-2">
            <Package className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <span>For items without serial numbers, like bags or cables. They are kept as one record with a count.</span>
          </p>
        )}

        <Field id="stock-item-name" label="Name" required error={errors.name}>
          <Input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError('name'); }}
            maxLength={150}
            placeholder="E.g., Laptop Bag"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="stock-item-category" label="Category">
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
              ))}
            </Select>
          </Field>

          <Field id="stock-item-location" label="Location">
            {useLocationText ? (
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                placeholder="E.g., Bengaluru"
              />
            ) : (
              <Select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">No location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
                {!locationInList && <option value={location}>{location} (current)</option>}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!isEdit && (
            <Field id="stock-item-quantity" label="Starting quantity" required error={errors.quantity}>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                max={MAX_STOCK_QUANTITY}
                step="1"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); clearError('quantity'); }}
                className="font-mono"
              />
            </Field>
          )}

          <div className="space-y-1.5">
            <label htmlFor="stock-item-cost" className="block text-sm font-medium text-primary">Cost per unit (₹)</label>
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
                className={`${controlClass(Boolean(errors.cost))} pl-8 font-mono`}
              />
            </div>
            {fieldError('cost')}
          </div>

          <Field id="stock-item-purchase-date" label="Purchase date">
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </Field>
        </div>

        <Field
          id="stock-item-threshold"
          label="Warn when stock is at or below"
          error={errors.threshold}
          hint='Shows a "Low stock" badge when this few are left on the shelf.'
        >
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            max={MAX_STOCK_QUANTITY}
            step="1"
            value={threshold}
            onChange={(e) => { setThreshold(e.target.value); clearError('threshold'); }}
            placeholder="Leave blank for no warning"
            className="font-mono"
          />
        </Field>

        <Field id="stock-item-notes" label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Supplier, size, colour…"
          />
        </Field>
      </form>
    </Modal>
  );
}
