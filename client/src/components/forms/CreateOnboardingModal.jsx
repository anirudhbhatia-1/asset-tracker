import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { getCategories } from '../../api/categoriesApi';
import { getEmployees } from '../../api/employeesApi';

const OFFICE_LOCATIONS = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];

const CreateOnboardingModal = ({ isOpen, onClose, onSubmit }) => {
  const [newHireName, setNewHireName] = useState('');
  const [newHireEmail, setNewHireEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([]);
  
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoadingContext(true);
        try {
          const [catRes, empRes] = await Promise.all([getCategories(), getEmployees()]);
          setCategories(catRes.data?.data || catRes.data || []);
          
          const emps = empRes.data?.data || empRes.data || [];
          const deps = new Set(emps.map(e => e.department).filter(Boolean));
          setDepartments(Array.from(deps).sort());
        } catch (err) {
          console.error('Failed to load categories', err);
        } finally {
          setLoadingContext(false);
        }
      };
      fetchData();
      
      // Default to tomorrow for joining date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setJoiningDate(tomorrow.toISOString().split('T')[0]);
    } else {
      setNewHireName('');
      setNewHireEmail('');
      setDepartment('');
      setLocation('');
      setJoiningDate('');
      setNotes('');
      setItems([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { categoryId: '', quantity: 1, notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      joiningDate,
      notes: notes || undefined,
      items: cleanItems.length > 0 ? cleanItems : undefined
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <h2 className="text-lg font-semibold text-primary">New Onboarding Request</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loadingContext ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <form id="onboarding-form" onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">New Hire Name <span className="text-error">*</span></label>
                  <input
                    type="text"
                    required
                    value={newHireName}
                    onChange={(e) => setNewHireName(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Personal Email</label>
                  <input
                    type="email"
                    value={newHireEmail}
                    onChange={(e) => setNewHireEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Department</label>
                  <select
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
                  <label className="text-sm font-medium text-primary">Location</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select Location...</option>
                    {OFFICE_LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Joining Date <span className="text-error">*</span></label>
                  <input
                    type="date"
                    required
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">General Notes</label>
                <textarea
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
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 p-3 bg-base rounded-lg border border-border animate-in fade-in">
                      <div className="flex-1">
                        <select
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
                      </div>
                      <div className="w-full sm:w-24">
                        <input
                          type="number"
                          min="1"
                          required
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
                          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2 text-secondary hover:text-error hover:bg-error/10 rounded-md transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            disabled={submitting || !newHireName.trim() || !joiningDate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
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
