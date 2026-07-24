import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import Badge from '../ui/Badge';

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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-base border border-border/80 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-xl font-bold text-primary">
            {initialData ? 'Edit Category' : 'Create Category'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-secondary hover:text-white hover:bg-surface transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-5">
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

          <div>
            <label htmlFor="catName" className="block text-sm font-semibold text-secondary mb-2">Category Name *</label>
            <input
              id="catName"
              required
              type="text"
              maxLength={100}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-base border border-border rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. Laptops, Networking"
            />
          </div>

          <div>
            <label htmlFor="catDesc" className="block text-sm font-semibold text-secondary mb-2">Description</label>
            <textarea
              id="catDesc"
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-base border border-border rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:border-accent transition-colors resize-none"
              placeholder="Optional description of items in this category"
            />
          </div>

          <div>
            <label htmlFor="catBadge" className="block text-sm font-semibold text-secondary mb-2">Badge Character</label>
            <input
              id="catBadge"
              type="text"
              maxLength={1}
              value={formData.badgeChar}
              onChange={(e) => setFormData({ ...formData, badgeChar: e.target.value.toUpperCase() })}
              className="w-20 bg-base border border-border rounded-xl px-4 py-3 text-center text-sm text-primary font-bold focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. L"
            />
            <p className="text-[11px] text-secondary mt-1.5">Leave blank to auto-use first letter of Name.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-3">Theme Color</label>
            <div className="grid grid-cols-4 gap-3">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c.value })}
                  className={`h-10 rounded-xl flex items-center justify-center transition-all ${
                    formData.color === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-base scale-105' : 'hover:scale-105'
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

        {/* Footer */}
        <div className="p-5 border-t border-border flex justify-end gap-3 bg-base/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-surface hover:bg-raised text-sm font-medium text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
            className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? 'Saving...' : 'Save Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
