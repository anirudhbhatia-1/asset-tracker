import React, { useState, useEffect, useRef, useId } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { getCategories } from '../../api/categoriesApi';
import { getDepartments } from '../../api/employeesApi';
import { onboardingApi } from '../../api/onboardingApi';
import useLocations from '../../hooks/useLocations';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';
import { toDateInputValue } from '../../utils/dates';

const toFormItem = (item) => ({
  categoryId: item.category_id,
  quantity: item.quantity,
  notes: item.notes || '',
  // Items with an asset linked stay put; the server refuses to drop them.
  fulfilled: Boolean(item.fulfilled_asset_id),
});

const EditOnboardingModal = ({ isOpen, onClose, onUpdate, request }) => {
  const { locations } = useLocations(isOpen);
  const [newHireName, setNewHireName] = useState('');
  const [newHireEmail, setNewHireEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([]);
  // List rows carry no items, so they are loaded here. Until they are,
  // `items` is left out of the update so the server keeps them as they are.
  const [itemsLoaded, setItemsLoaded] = useState(false);
  
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Bumped every time the modal opens, switches request or closes. Async
  // work captures the value it started with and drops its result when the
  // value has moved on, so a late response from an earlier opening (or one
  // arriving after Cancel) never overwrites the current form.
  const sessionRef = useRef(0);
  const fieldId = useId();

  useEffect(() => {
    const session = ++sessionRef.current;
    const isCurrent = () => sessionRef.current === session;
    if (isOpen && request) {
      const fetchData = async () => {
        setLoadingContext(true);
        try {
          const catRes = await getCategories();
          if (isCurrent()) setCategories(catRes.data?.data || catRes.data || []);
        } catch (err) {
          console.error('Failed to load categories:', err);
        }
        try {
          const depRes = await getDepartments();
          if (isCurrent()) setDepartments(depRes.data?.data || depRes.data || []);
        } catch (err) {
          console.warn('Could not load departments:', err.message);
        }
        try {
          const full = request.items ? request : await onboardingApi.getById(request.id);
          if (!isCurrent()) return;
          setItems((full.items || []).map(toFormItem));
          setItemsLoaded(true);
        } catch (err) {
          console.warn('Could not load onboarding items:', err.message);
        } finally {
          if (isCurrent()) setLoadingContext(false);
        }
      };
      setItems([]);
      setItemsLoaded(false);
      fetchData();
      
      setNewHireName(request.new_hire_name || '');
      setNewHireEmail(request.new_hire_email || '');
      setDepartment(request.department || '');
      setLocation(request.location || '');
      setAddress(request.address || '');
      setJoiningDate(toDateInputValue(request.joining_date));
      setNotes(request.notes || '');
    } else {
      setNewHireName('');
      setNewHireEmail('');
      setDepartment('');
      setLocation('');
      setAddress('');
      setJoiningDate('');
      setNotes('');
      setItems([]);
      setItemsLoaded(false);
      setLoadingContext(false);
      setSubmitting(false);
    }
    // Closing or switching request invalidates anything still in flight.
    return () => { sessionRef.current += 1; };
  }, [isOpen, request]);


  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { categoryId: '', quantity: 1, notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const session = sessionRef.current;
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
      // Sent whole once loaded (an empty list removes every unfulfilled
      // item); left out otherwise so nothing is dropped by accident.
      items: itemsLoaded ? cleanItems : undefined
    };

    try {
      await onUpdate(request.id, payload);
      // Cancelled or reopened meanwhile: that session owns the modal now.
      if (sessionRef.current === session) onClose();
    } catch {
      // Error handled by hook
    } finally {
      if (sessionRef.current === session) setSubmitting(false);
    }
  };

  const idFor = (name) => `${fieldId}-${name}`;
  const parseAddresses = (loc) => {
    if (!loc?.addresses) return [];
    if (Array.isArray(loc.addresses)) return loc.addresses;
    try { return JSON.parse(loc.addresses) || []; } catch { return []; }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Onboarding Request"
      maxWidth="max-w-2xl"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="onboarding-form" loading={submitting}>
            Save Changes
          </Button>
        </>
      )}
    >
      {loadingContext ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : (
        <form id="onboarding-form" onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id={idFor('name')} label="New Hire Name" required>
              <Input
                type="text"
                value={newHireName}
                onChange={(e) => setNewHireName(e.target.value)}
              />
            </Field>
            <Field id={idFor('email')} label="Personal Email">
              <Input
                type="email"
                value={newHireEmail}
                onChange={(e) => setNewHireEmail(e.target.value)}
              />
            </Field>
            <Field id={idFor('department')} label="Department">
              <Select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Select Department...</option>
                {departments.map(dep => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </Select>
            </Field>
            <Field id={idFor('location')} label="Location">
              <Select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">Select Location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </Field>
            {location && (() => {
              const selectedLoc = locations.find(l => l.name === location);
              const addrs = parseAddresses(selectedLoc);
              if (addrs.length === 0) return null;
              return (
                <Field id={idFor('address')} label="Address">
                  <Select
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  >
                    <option value="">Select Address...</option>
                    {addrs.map((addr, idx) => (
                      <option key={idx} value={addr}>{addr}</option>
                    ))}
                  </Select>
                </Field>
              );
            })()}
            <Field id={idFor('joining')} label="Joining Date" required>
              <Input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </Field>
          </div>

          <Field id={idFor('notes')} label="General Notes">
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
                disabled={!itemsLoaded}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Item
              </Button>
            </div>
            
            {!itemsLoaded && (
              <p className="text-xs text-warning">
                The requested items could not be loaded; saving keeps them unchanged.
              </p>
            )}

            {itemsLoaded && items.length === 0 && (
              <div className="text-sm text-secondary text-center py-4 bg-base rounded-lg border border-dashed border-border">
                No hardware requested yet. Click 'Add Item' to request equipment.
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 p-3 bg-base rounded-lg border border-border animate-fadeIn">
                  <div className="flex-1">
                    <Select
                      required
                      aria-label={`Item ${idx + 1} category`}
                      value={item.categoryId}
                      disabled={item.fulfilled}
                      title={item.fulfilled ? 'An asset is already linked to this item' : undefined}
                      onChange={(e) => handleItemChange(idx, 'categoryId', e.target.value)}
                    >
                      <option value="">Select Category...</option>
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
                      aria-label={`Item ${idx + 1} notes`}
                      value={item.notes}
                      onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                      placeholder="Notes (e.g. Mac/Windows)"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={item.fulfilled}
                    title={item.fulfilled ? 'An asset is already linked; unassign it before removing this item' : undefined}
                    className="p-2 text-secondary hover:text-error hover:bg-error/10 rounded-md transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </form>
      )}
    </Modal>
  );
};

export default EditOnboardingModal;
