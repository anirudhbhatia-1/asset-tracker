import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeAssets } from '../../api/employeesApi';
import { getCategories } from '../../api/categoriesApi';
import toast from 'react-hot-toast';

const CreateTicketModal = ({ isOpen, onClose, onSubmit, initialType = 'issue', initialAssetId = '' }) => {
  const { user } = useAuth();
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState(initialAssetId);
  const [categoryId, setCategoryId] = useState('');
  const [targetAdminType, setTargetAdminType] = useState('it');
  
  const [myAssets, setMyAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setAssetId(initialAssetId);
      
      const fetchData = async () => {
        setLoadingContext(true);
        try {
          const catPromise = getCategories()
            .then(res => setCategories(res.data?.data || res.data || []))
            .catch(err => {
              console.error('Failed to load categories for ticket form:', err);
              if (err.response?.status !== 403) {
                toast.error('Failed to load categories');
              }
            });

          const assetPromise = user?.id
            ? getEmployeeAssets(user.id)
                .then(res => setMyAssets(res.data?.data || res.data || []))
                .catch(err => console.error('Failed to load employee assets for ticket form:', err))
            : Promise.resolve();

          await Promise.allSettled([catPromise, assetPromise]);
        } finally {
          setLoadingContext(false);
        }
      };
      fetchData();
    } else {
      // Reset state on close
      setType(initialType);
      setTitle('');
      setDescription('');
      setAssetId(initialAssetId);
      setCategoryId('');
      setTargetAdminType('it');
    }
  }, [isOpen, user, initialType, initialAssetId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    const payload = {
      type,
      title,
      description: description || undefined,
      assetId: type === 'issue' && assetId ? parseInt(assetId, 10) : undefined,
      categoryId: type === 'request' && categoryId ? parseInt(categoryId, 10) : undefined,
      targetAdminType,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      // Error is handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50">
          <h2 className="text-lg font-semibold text-primary">Raise a Ticket</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {loadingContext ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Ticket Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="issue" 
                      checked={type === 'issue'} 
                      onChange={(e) => setType(e.target.value)}
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-secondary">Report an Issue</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="request" 
                      checked={type === 'request'} 
                      onChange={(e) => setType(e.target.value)}
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-secondary">Request Hardware</span>
                  </label>
                </div>
              </div>

              {type === 'issue' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <label className="text-sm font-medium text-primary">Which device is having issues?</label>
                  <select
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select a device (Optional)</option>
                    {myAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>{asset.name} ({asset.serialNumber})</option>
                    ))}
                  </select>
                </div>
              )}

              {type === 'request' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <label className="text-sm font-medium text-primary">What do you need?</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select category (Optional)</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Department</label>
                <select
                  value={targetAdminType}
                  onChange={(e) => setTargetAdminType(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="it">IT Admin</option>
                  <option value="hardware">Hardware Admin</option>
                  {/* HR raising a ticket would not target themselves */}
                  {user?.role !== 'hr' && <option value="hr">HR Admin</option>}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Title</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g., Laptop screen flickering"
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide more details..."
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Ticket
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateTicketModal;
