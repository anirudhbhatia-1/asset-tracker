import React, { useState, useEffect, useRef, useId } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { getCategories } from '../../api/categoriesApi';
import { getDepartments } from '../../api/employeesApi';
import useLocations from '../../hooks/useLocations';
import useFocusTrap from '../../hooks/useFocusTrap';
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

  const dialogRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen, onClose);

  // The form renders after its dropdown data loads, so start on the name
  // field once it exists (desktop only: on touch screens it would pop the
  // keyboard over the dialog).
  useEffect(() => {
    if (!isOpen || loadingContext || !dialogRef.current) return;
    const active = document.activeElement;
    const onField = active && dialogRef.current.contains(active) && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-base/75 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90dvh] animate-scaleUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-primary">New Onboarding Request</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2.5 sm:p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loadingContext ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <form id="onboarding-form" onSubmit={handleSubmit} noValidate className="space-y-6">
              <p className="text-xs text-secondary -mb-2">Fields marked <span className="text-error">*</span> are required.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="onb-new-name" className="text-sm font-medium text-primary">New Hire Name <span className="text-error">*</span></label>
                  <input
                    id="onb-new-name"
                    type="text"
                    required
                    value={newHireName}
                    onChange={(e) => { setNewHireName(e.target.value); clearError('name'); }}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'onb-new-name-error' : undefined}
                    className={`w-full px-3 py-2 bg-base border ${errors.name ? 'border-error' : 'border-border'} rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent`}
                  />
                  {errors.name && <p id="onb-new-name-error" role="alert" className="text-xs text-error">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="onb-new-email" className="text-sm font-medium text-primary">Personal Email</label>
                  <input
                    id="onb-new-email"
                    type="email"
                    value={newHireEmail}
                    onChange={(e) => setNewHireEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="onb-new-department" className="text-sm font-medium text-primary">Department</label>
                  <select
                    id="onb-new-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select Department...</option>
                    {departments.map(dep => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="onb-new-location" className="text-sm font-medium text-primary">Location</label>
                  <select
                    id="onb-new-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select Location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                {location && (() => {
                  const selectedLoc = locations.find(l => l.name === location);
                  const addrs = selectedLoc?.addresses ? (Array.isArray(selectedLoc.addresses) ? selectedLoc.addresses : JSON.parse(selectedLoc.addresses)) : [];
                  if (addrs.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <label htmlFor="onb-new-address" className="text-sm font-medium text-primary">Address</label>
                      <select
                        id="onb-new-address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      >
                        <option value="">Select Address...</option>
                        {addrs.map((addr, idx) => (
                          <option key={idx} value={addr}>{addr}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
                <div className="space-y-2">
                  <label htmlFor="onb-new-joining" className="text-sm font-medium text-primary">Joining Date <span className="text-error">*</span></label>
                  <input
                    id="onb-new-joining"
                    type="date"
                    required
                    value={joiningDate}
                    onChange={(e) => { setJoiningDate(e.target.value); clearError('joiningDate'); }}
                    aria-invalid={errors.joiningDate ? true : undefined}
                    aria-describedby={errors.joiningDate ? 'onb-new-joining-error' : undefined}
                    className={`w-full px-3 py-2 bg-base border ${errors.joiningDate ? 'border-error' : 'border-border'} rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent`}
                  />
                  {errors.joiningDate && <p id="onb-new-joining-error" role="alert" className="text-xs text-error">{errors.joiningDate}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="onb-new-notes" className="text-sm font-medium text-primary">General Notes</label>
                <textarea
                  id="onb-new-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <hr className="border-border" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-primary">Hardware Requirements</h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
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
                        <select
                          id={`onb-new-item-${idx}-category`}
                          aria-label={`Item ${idx + 1} category (required)`}
                          aria-invalid={errors[`item-${idx}`] ? true : undefined}
                          required
                          value={item.categoryId}
                          onChange={(e) => handleItemChange(idx, 'categoryId', e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        >
                          <option value="">Select Category...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {categories.length === 0 && !loadingContext && (
                          <p className="text-xs text-warning mt-1">
                            No categories available. Ask an admin to create asset categories first.
                          </p>
                        )}
                      </div>
                      <div className="w-full sm:w-24">
                        <input
                          type="number"
                          min="1"
                          required
                          aria-label={`Item ${idx + 1} quantity`}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                          placeholder="Notes (e.g. Mac/Windows)"
                          aria-label={`Item ${idx + 1} notes`}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-base/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            form="onboarding-form"
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateOnboardingModal;
