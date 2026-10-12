import React, { useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import useLocations from '../../hooks/useLocations';

const KEEP = '';
const SELECT_CLASS = 'w-full rounded-xl bg-base border border-border px-3.5 py-2.5 text-base sm:text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer';

/** Moves the selected assets to another location and/or category. */
export default function BulkEditModal({ isOpen, onClose, count = 0, categories = [], onSave }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Change location / category (${count})`} maxWidth="max-w-md">
      {isOpen && <EditForm onClose={onClose} categories={categories} onSave={onSave} />}
    </Modal>
  );
}

function EditForm({ onClose, categories, onSave }) {
  const { locations, loading: locationsLoading } = useLocations();
  const [location, setLocation] = useState(KEEP);
  const [categoryId, setCategoryId] = useState(KEEP);
  const [submitting, setSubmitting] = useState(false);
  const hasChanges = location !== KEEP || categoryId !== KEEP;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasChanges) return;
    const changes = {};
    if (location !== KEEP) changes.location = location;
    if (categoryId !== KEEP) changes.categoryId = Number(categoryId);
    setSubmitting(true);
    try {
      await onSave(changes);
      onClose();
    } catch {
      // The hook showed the error toast.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-secondary">Pick what to change. Fields left on “Keep current” stay as they are on each asset.</p>
      <div>
        <label htmlFor="bulk-edit-location" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">Location</label>
        <select id="bulk-edit-location" value={location} onChange={(e) => setLocation(e.target.value)} className={SELECT_CLASS} disabled={locationsLoading && locations.length === 0}>
          <option value={KEEP}>Keep current</option>
          {locations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="bulk-edit-category" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">Category</label>
        <select id="bulk-edit-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={SELECT_CLASS}>
          <option value={KEEP}>Keep current</option>
          {categories.map((cat) => <option key={cat.id} value={String(cat.id)}>{cat.name}</option>)}
        </select>
      </div>
      <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button type="submit" loading={submitting} disabled={!hasChanges}>
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>Apply changes</span>
        </Button>
      </div>
    </form>
  );
}
