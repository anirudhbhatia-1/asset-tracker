import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Textarea } from '../ui/Field';

const COLOR_OPTIONS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Fuchsia', value: '#d946ef' },
  { label: 'Slate', value: '#64748b' },
  { label: 'Violet', value: '#8b5cf6' }
];

export default function CategoryBuilder({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    badgeChar: '',
    color: '#6366f1'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          description: initialData.description || '',
          badgeChar: initialData.badgeChar || '',
          color: initialData.color || '#6366f1'
        });
      } else {
        setFormData({ name: '', description: '', badgeChar: '', color: '#6366f1' });
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch {
      // The parent already showed the error toast; keep the builder open.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Category' : 'Create Category'}
      maxWidth="max-w-md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name.trim()}>
            {isSubmitting ? 'Saving...' : 'Save Category'}
          </Button>
        </>
      )}
    >
      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Live Preview */}
        <div className="flex items-center justify-center p-6 bg-base/50 rounded-xl border border-border/60 mb-2">
          <div className="text-center">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wider mb-3">Live Badge Preview</p>
            <div className="flex items-center gap-3">
              <Badge
                badgeChar={formData.badgeChar || formData.name}
                color={formData.color}
                className="!w-12 !h-12 !text-lg"
              />
              <div className="text-left">
                <h4 className="text-lg font-bold text-primary">{formData.name || 'Category Name'}</h4>
              </div>
            </div>
          </div>
        </div>

        <Field id="catName" label="Category Name" required>
          <Input
            type="text"
            maxLength={100}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Laptops, Networking"
          />
        </Field>

        <Field id="catDesc" label="Description">
          <Textarea
            rows={3}
            maxLength={500}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description of items in this category"
          />
        </Field>

        <Field id="catBadge" label="Badge Character" hint="Leave blank to auto-use first letter of Name.">
          <Input
            type="text"
            maxLength={1}
            value={formData.badgeChar}
            onChange={(e) => setFormData({ ...formData, badgeChar: e.target.value.toUpperCase() })}
            className="!w-20 text-center font-bold"
            placeholder="e.g. L"
          />
        </Field>

        <div>
          <span className="block text-sm font-medium text-primary mb-3">Theme Color</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setFormData({ ...formData, color: c.value })}
                className={`h-10 rounded-xl flex items-center justify-center transition-all ${
                  formData.color === c.value ? 'ring-2 ring-primary ring-offset-2 ring-offset-base scale-105' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
                aria-label={`Select color ${c.label}`}
              >
                {formData.color === c.value && <Check className="w-4 h-4 text-white drop-shadow-md" />}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
