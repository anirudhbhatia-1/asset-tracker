import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Wrench, PackagePlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeAssets } from '../../api/employeesApi';
import { getCategories } from '../../api/categoriesApi';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';
import { DEFAULT_PRIORITY, PRIORITIES, QUEUE_HINTS, defaultQueueFor, queueLabel, resolveRequestedItem } from '../../utils/ticketMeta';

const TYPES = [
  { value: 'issue', label: 'Report a Problem', hint: 'Something is broken or not working', icon: Wrench },
  { value: 'request', label: 'Request Something', hint: 'New equipment or accessories', icon: PackagePlus },
];

const PRIORITY_HINT = 'High and Urgent tickets go to another team if nobody starts on them within 10 minutes. Choose Urgent only if you can’t work.';

const CreateTicketModal = ({ isOpen, onClose, onSubmit, initialType = 'issue', initialAssetId = '' }) => {
  const { user } = useAuth();
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState(initialAssetId);
  // "What do you need?": a category name or anything typed.
  const [requestText, setRequestText] = useState('');
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  // Follows the ticket type until the person picks a department themselves.
  const [targetAdminType, setTargetAdminType] = useState(defaultQueueFor(initialType));
  const [departmentChosen, setDepartmentChosen] = useState(false);

  const [myAssets, setMyAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState(null);
  const titleInputRef = useRef(null);
  // Only the id is used below; depending on the whole user object would reset
  // the form whenever the session refreshes it while the dialog is open.
  const userId = user?.id;
  // HR raising a ticket would not target themselves.
  const queues = ['it', 'hardware', ...(user?.role !== 'hr' ? ['hr'] : [])];

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setTargetAdminType(defaultQueueFor(initialType));
      setDepartmentChosen(false);
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

          const assetPromise = userId
            ? getEmployeeAssets(userId)
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
      setTargetAdminType(defaultQueueFor(initialType));
      setDepartmentChosen(false);
      setTitleError(null);
    }
  }, [isOpen, userId, initialType, initialAssetId]);

  // Move to the title once the form is there (desktop only: on touch screens
  // it would pop the keyboard).
  useEffect(() => {
    if (!isOpen || loadingContext) return;
    let coarse = false;
    try { coarse = window.matchMedia?.('(pointer: coarse)').matches; } catch { coarse = false; }
    if (!coarse) titleInputRef.current?.focus();
  }, [isOpen, loadingContext]);

  const chooseType = (value) => {
    setType(value);
    if (!departmentChosen) setTargetAdminType(defaultQueueFor(value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Enter a short title for the ticket.');
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raise a Ticket"
      footer={!loadingContext && (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-ticket-form" loading={submitting}>Submit Ticket</Button>
        </>
      )}
    >
      {loadingContext ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" aria-label="Loading" />
        </div>
      ) : (
        <form id="create-ticket-form" onSubmit={handleSubmit} noValidate className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium text-primary mb-2">What do you need help with?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TYPES.map(({ value, label, hint, icon: Icon }) => (
                <label
                  key={value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                    type === value ? 'border-accent bg-accent/5' : 'border-border hover:bg-raised/50'
                  }`}
                >
                  <input type="radio" name="ticket-type" value={value} checked={type === value} onChange={() => chooseType(value)} className="sr-only" />
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${type === value ? 'text-accent' : 'text-secondary'}`} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium text-primary">{label}</span>
                    <span className="block text-xs text-secondary">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field id="ticket-new-title" label="Title" required error={titleError}>
            <Input
              ref={titleInputRef}
              type="text"
              maxLength={150}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError && e.target.value.trim()) setTitleError(null);
              }}
              placeholder={type === 'issue' ? 'E.g., Laptop screen flickering' : 'E.g., Need a second monitor'}
            />
          </Field>

          {type === 'issue' ? (
            <Field id="ticket-new-asset" label="Which device? (optional)">
              <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">Not about a specific device</option>
                {myAssets.map(asset => (
                  <option key={asset.id} value={asset.id}>{asset.name} ({asset.serialNumber})</option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field id="ticket-new-category" label="What do you need? (optional)" hint="Pick from the list or type what you need if it isn't there.">
              {/* Pick a category from the list, or type anything else. */}
              <Input
                type="text"
                list="ticket-new-category-options"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                maxLength={100}
                autoComplete="off"
                placeholder="E.g. Monitor or Ergonomic chair"
              />
            </Field>
          )}
          <datalist id="ticket-new-category-options">
            {categories.map(cat => (
              <option key={cat.id} value={cat.name} />
            ))}
          </datalist>

          <Field id="ticket-new-description" label="Details (optional)">
            <Textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened, since when, anything you already tried…"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="ticket-new-priority" label="Priority" hint={PRIORITY_HINT}>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="ticket-new-department" label="Goes to" hint={QUEUE_HINTS[targetAdminType]}>
              <Select
                value={targetAdminType}
                onChange={(e) => { setTargetAdminType(e.target.value); setDepartmentChosen(true); }}
              >
                {queues.map((queue) => (
                  <option key={queue} value={queue}>{queueLabel(queue)}</option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default CreateTicketModal;
