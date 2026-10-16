import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { getCategories } from '../../api/categoriesApi';
import { getDepartments } from '../../api/employeesApi';
import useLocations from '../../hooks/useLocations';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';
import { addDaysLocalISO } from '../../utils/dates';

const CreateOnboardingModal = ({ isOpen, onClose, onSubmit }) => {
  const { locations } = useLocations(isOpen);
  const [newHireName, setNewHireName] = useState('');
  const [newHireEmail, setNewHireEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([]);
  
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Field -> message, filled on submit so a missing field is named, not
  // just a greyed-out button. Item errors are keyed `item-<index>`.
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoadingContext(true);
        try {
          const catRes = await getCategories();
          setCategories(catRes.data?.data || catRes.data || []);
        } catch (err) {
          console.error('Failed to load categories:', err);
        }
        try {
          const depRes = await getDepartments();
          setDepartments(depRes.data?.data || depRes.data || []);
        } catch (err) {
          console.warn('Could not load departments:', err.message);
        } finally {
          setLoadingContext(false);
        }
      };
      fetchData();
      
      // Default to tomorrow for joining date
      setJoiningDate(addDaysLocalISO(1));
    } else {
      setNewHireName('');
      setNewHireEmail('');
      setDepartment('');
      setLocation('');
      setAddress('');
      setJoiningDate('');
      setNotes('');
      setItems([]);
      setErrors({});
    }
  }, [isOpen]);


  // The form renders after its dropdown data loads, so start on the name
  // field once it exists (desktop only: on touch screens it would pop the
  // keyboard over the dialog).
  useEffect(() => {
    if (!isOpen || loadingContext) return;
    const active = document.activeElement;
    const onField = active && active.closest?.('#onboarding-form') && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
    let coarse = false;
    try { coarse = window.matchMedia?.('(pointer: coarse)').matches; } catch { coarse = false; }
    if (!onField && !coarse) document.getElementById('onb-new-name')?.focus();
  }, [isOpen, loadingContext]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { categoryId: '', quantity: 1, notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    // Item errors are keyed by index, which just shifted.
    setErrors(({ name, joiningDate: dateError }) => ({ ...(name && { name }), ...(dateError && { joiningDate: dateError }) }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
    clearError(`item-${index}`);
  };

  const clearError = (key) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const next = {};
    if (!newHireName.trim()) next.name = 'Enter the new hire\'s name.';
    if (!joiningDate) next.joiningDate = 'Choose a joining date.';
    items.forEach((item, idx) => {
      if (!item.categoryId) next[`item-${idx}`] = 'Choose a category for this item.';
      else if (!(parseInt(item.quantity, 10) >= 1)) next[`item-${idx}`] = 'Quantity must be at least 1.';
    });
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      const targetId = firstKey === 'name' ? 'onb-new-name'
        : firstKey === 'joiningDate' ? 'onb-new-joining'
        : `onb-new-item-${firstKey.slice(5)}-category`;
      document.getElementById(targetId)?.focus();
      return;
    }
    setSubmitting(true);
    
    // Clean up items
    const cleanItems = items
      .filter(i => i.categoryId)
      .map(i => ({
        categoryId: parseInt(i.categoryId, 10),
        quantity: parseInt(i.quantity, 10) || 1,
        notes: i.notes || undefined
      }));

    const payload = {
      newHireName,
      newHireEmail: newHireEmail || undefined,
      department: department || undefined,
      location: location || undefined,
      address: address || undefined,
      joiningDate,
      notes: notes || undefined,
      items: cleanItems.length > 0 ? cleanItems : undefined
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Onboarding Request"
      maxWidth="max-w-2xl"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="onboarding-form" loading={submitting}>
            Submit Request
          </Button>
        </>
      )}
    >
      {loadingContext ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : (
        <form id="onboarding-form" onSubmit={handleSubmit} noValidate className="space-y-6">
          <p className="text-xs text-secondary -mb-2">Fields marked <span className="text-error">*</span> are required.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="onb-new-name" label="New Hire Name" required error={errors.name}>
              <Input
                type="text"
                value={newHireName}
                onChange={(e) => { setNewHireName(e.target.value); clearError('name'); }}
              />
            </Field>
            <Field id="onb-new-email" label="Personal Email">
              <Input
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={newHireEmail}
                onChange={(e) => setNewHireEmail(e.target.value)}
              />
            </Field>
            <Field id="onb-new-department" label="Department">
              <Select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Select Department…</option>
                {departments.map(dep => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </Select>
            </Field>
            <Field id="onb-new-location" label="Location">
              <Select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">Select Location…</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </Field>
            {location && (() => {
              const selectedLoc = locations.find(l => l.name === location);
              const addrs = selectedLoc?.addresses ? (Array.isArray(selectedLoc.addresses) ? selectedLoc.addresses : JSON.parse(selectedLoc.addresses)) : [];
              if (addrs.length === 0) return null;
              return (
                <Field id="onb-new-address" label="Address">
                  <Select
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  >
                    <option value="">Select Address…</option>
                    {addrs.map((addr, idx) => (
                      <option key={idx} value={addr}>{addr}</option>
                    ))}
                  </Select>
                </Field>
              );
            })()}
            <Field id="onb-new-joining" label="Joining Date" required error={errors.joiningDate}>
              <Input
                type="date"
                value={joiningDate}
                onChange={(e) => { setJoiningDate(e.target.value); clearError('joiningDate'); }}
              />
            </Field>
          </div>

          <Field id="onb-new-notes" label="General Notes">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <hr className="border-border" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary">Hardware Requirements</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddItem}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Item
              </Button>
            </div>
            
            {items.length === 0 && (
              <div className="text-sm text-secondary text-center py-4 bg-base rounded-lg border border-dashed border-border">
                No hardware requested yet. Click 'Add Item' to request equipment.
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className={`p-3 bg-base rounded-lg border ${errors[`item-${idx}`] ? 'border-error' : 'border-border'} animate-fadeIn`}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Select
                      id={`onb-new-item-${idx}-category`}
                      aria-label={`Item ${idx + 1} category (required)`}
                      invalid={Boolean(errors[`item-${idx}`])}
                      required
                      value={item.categoryId}
                      onChange={(e) => handleItemChange(idx, 'categoryId', e.target.value)}
                    >
                      <option value="">Select Category…</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    {categories.length === 0 && !loadingContext && (
                      <p className="text-xs text-warning mt-1">
                        No categories available. Ask an admin to create asset categories first.
                      </p>
                    )}
                  </div>
                  <div className="w-full sm:w-24">
                    <Input
                      type="number"
                      min="1"
                      required
                      aria-label={`Item ${idx + 1} quantity`}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                      placeholder="Notes (e.g. Mac/Windows)"
                      aria-label={`Item ${idx + 1} notes`}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove item ${idx + 1}`}
                    onClick={() => handleRemoveItem(idx)}
                    className="p-2.5 sm:p-2 self-end sm:self-auto text-secondary hover:text-error hover:bg-error/10 rounded-md transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {errors[`item-${idx}`] && (
                  <p role="alert" className="text-xs text-error mt-2">{errors[`item-${idx}`]}</p>
                )}
                </div>
              ))}
            </div>
          </div>

        </form>
      )}
    </Modal>
  );
};

export default CreateOnboardingModal;
