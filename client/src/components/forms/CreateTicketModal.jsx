import React, { useState, useEffect, useRef, useId } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeAssets } from '../../api/employeesApi';
import { getCategories } from '../../api/categoriesApi';
import toast from 'react-hot-toast';
import useFocusTrap from '../../hooks/useFocusTrap';
import { DEFAULT_PRIORITY, PRIORITIES, queueLabel, resolveRequestedItem } from '../../utils/ticketMeta';

const CreateTicketModal = ({ isOpen, onClose, onSubmit, initialType = 'issue', initialAssetId = '' }) => {
  const { user } = useAuth();
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState(initialAssetId);
  // "What do you need?": a category name or anything typed.
  const [requestText, setRequestText] = useState('');
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [targetAdminType, setTargetAdminType] = useState('it');
  
  const [myAssets, setMyAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState(null);
  const titleInputRef = useRef(null);

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
      setRequestText('');
      setPriority(DEFAULT_PRIORITY);
      setTargetAdminType('it');
      setTitleError(null);
    }
  }, [isOpen, user, initialType, initialAssetId]);

  const dialogRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen, onClose);

  // The form renders after its dropdown data loads, so the focus trap can
  // only focus the Close button on open; move to the first field once it
  // exists (desktop only: on touch screens it would pop the keyboard).
  useEffect(() => {
    if (!isOpen || loadingContext || !dialogRef.current) return;
    const active = document.activeElement;
    const onField = active && dialogRef.current.contains(active) && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
    let coarse = false;
    try { coarse = window.matchMedia?.('(pointer: coarse)').matches; } catch { coarse = false; }
    if (!onField && !coarse) dialogRef.current.querySelector('select, input[type="text"]')?.focus();
  }, [isOpen, loadingContext]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Enter a title for the ticket.');
      titleInputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    
    const requested = type === 'request' ? resolveRequestedItem(requestText, categories) : {};
    const payload = {
      type,
      title,
      description: description || undefined,
      assetId: type === 'issue' && assetId ? parseInt(assetId, 10) : undefined,
      categoryId: requested.categoryId,
      requestedItem: requested.requestedItem,
      priority,
      targetAdminType,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // Error is handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-base/75 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-scaleUp flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-primary">Raise a Ticket</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2.5 sm:p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5 overflow-y-auto">
          {loadingContext ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-xs text-secondary">Fields marked <span className="text-error">*</span> are required.</p>
              <div className="space-y-2">
                <span className="text-sm font-medium text-primary">Ticket Type</span>
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
                <div className="space-y-2 animate-fadeIn">
                  <label htmlFor="ticket-new-asset" className="text-sm font-medium text-primary">Which device is having issues?</label>
                  <select
                    id="ticket-new-asset"
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
                <div className="space-y-2 animate-fadeIn">
                  <label htmlFor="ticket-new-category" className="text-sm font-medium text-primary">What do you need?</label>
                  {/* Pick a category from the list, or type anything else. */}
                  <input
                    id="ticket-new-category"
                    type="text"
                    list="ticket-new-category-options"
                    value={requestText}
                    onChange={(e) => setRequestText(e.target.value)}
                    maxLength={100}
                    autoComplete="off"
                    placeholder="Choose or type, e.g. Monitor or Ergonomic chair (optional)"
                    aria-describedby="ticket-new-category-hint"
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                  <datalist id="ticket-new-category-options">
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name} />
                    ))}
                  </datalist>
                  <p id="ticket-new-category-hint" className="text-xs text-secondary">
                    Pick from the list or type what you need if it isn't there.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="ticket-new-department" className="text-sm font-medium text-primary">Department</label>
                <select
                  id="ticket-new-department"
                  value={targetAdminType}
                  onChange={(e) => setTargetAdminType(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="it">{queueLabel('it')}</option>
                  <option value="hardware">{queueLabel('hardware')}</option>
                  {/* HR raising a ticket would not target themselves */}
                  {user?.role !== 'hr' && <option value="hr">{queueLabel('hr')}</option>}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="ticket-new-priority" className="text-sm font-medium text-primary">Priority</label>
                <select
                  id="ticket-new-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="ticket-new-title" className="text-sm font-medium text-primary">Title <span className="text-error" aria-hidden="true">*</span></label>
                <input
                  ref={titleInputRef}
                  id="ticket-new-title"
                  type="text"
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (titleError && e.target.value.trim()) setTitleError(null);
                  }}
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? 'ticket-new-title-error' : undefined}
                  placeholder="E.g., Laptop screen flickering"
                  className={`w-full px-3 py-2 bg-base border ${titleError ? 'border-error' : 'border-border'} rounded-lg text-primary text-sm placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent`}
                />
                {titleError && (
                  <p id="ticket-new-title-error" role="alert" className="text-xs text-error">{titleError}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="ticket-new-description" className="text-sm font-medium text-primary">Description</label>
                <textarea
                  id="ticket-new-description"
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
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
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
