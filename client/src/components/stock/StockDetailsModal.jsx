import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import StockItemModal from './StockItemModal';
import StockAssignModal from './StockAssignModal';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  validateQuantity, parseQuantity, adjustmentChange, lowStockText, deleteBlockedReason,
  stockEventLabel, stockEventNote, stockEventTone,
} from '../../utils/stock';
import { workModeLabel, showsWorkModeBadge } from '../../utils/workMode';
import {
  AlertTriangle, MapPin, Pencil, Trash2, UserPlus, Undo2, PackageMinus, Users, History, Loader2, Plus, Minus,
} from 'lucide-react';

const inputClass = 'w-full rounded-xl bg-base border border-border px-3 py-2 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5';
const sectionTitle = 'text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-2';

const TONE_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  accent: 'bg-accent',
  muted: 'bg-secondary',
};

function SummaryTile({ label, value, emphasis }) {
  return (
    <div className="bg-base/60 border border-border/60 rounded-xl px-3 py-2.5 min-w-0">
      <dt className="text-[11px] font-semibold text-secondary uppercase tracking-wider">{label}</dt>
      <dd className={`mt-0.5 text-base font-bold font-mono truncate ${emphasis || 'text-primary'}`}>{value}</dd>
    </div>
  );
}

/** Return / write-off form shown inside a holder's row. */
function HolderActionForm({ holder, mode, itemName, onCancel, onSubmit }) {
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isWriteOff = mode === 'writeoff';
  const idBase = `stock-holder-${holder.employeeId}-${mode}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qtyError = validateQuantity(quantity, { min: 1, max: holder.quantity });
    setError(qtyError);
    if (qtyError) return;
    setSubmitting(true);
    try {
      await onSubmit({ employeeId: holder.employeeId, quantity: parseQuantity(quantity), note: note.trim() || undefined });
    } catch {
      // The hook already showed the error toast.
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`mt-3 p-3 rounded-xl border space-y-3 ${isWriteOff ? 'bg-error/5 border-error/30' : 'bg-surface border-border'}`}
    >
      {isWriteOff && (
        <p className="text-xs text-error flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Write off means {holder.name}'s {itemName} is lost or broken. It does not go back on the shelf and
            the total drops. This can't be undone.
          </span>
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-3">
        <div>
          <label htmlFor={`${idBase}-qty`} className={labelClass}>Quantity</label>
          <input
            id={`${idBase}-qty`}
            type="number"
            inputMode="numeric"
            min="1"
            max={holder.quantity}
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${idBase}-error` : `${idBase}-hint`}
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label htmlFor={`${idBase}-note`} className={labelClass}>Note (optional)</label>
          <input
            id={`${idBase}-note`}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder={isWriteOff ? 'E.g., strap broken' : 'E.g., not needed any more'}
            className={inputClass}
          />
        </div>
      </div>
      {error
        ? <p id={`${idBase}-error`} role="alert" className="text-xs text-danger">{error}</p>
        : <p id={`${idBase}-hint`} className="text-xs text-secondary">{holder.name} has {holder.quantity}.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" variant={isWriteOff ? 'danger' : 'primary'} size="sm" loading={submitting}>
          {isWriteOff ? 'Write off' : 'Return to stock'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Details of one bulk item: counts, stock changes, who holds it and its
 * history. `actions` are the useStock mutations; each resolves to the
 * updated item, which replaces what is shown.
 */
export default function StockDetailsModal({ isOpen, itemId, onClose, actions }) {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('assets:update');
  const canAssign = hasPermission('assets:assign');
  const canDelete = hasPermission('assets:delete');

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  // 'edit' | 'assign' swaps this dialog for that one (no stacked dialogs).
  const [subDialog, setSubDialog] = useState(null);
  // { employeeId, mode: 'return' | 'writeoff' } for the open holder form.
  const [holderAction, setHolderAction] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [direction, setDirection] = useState('add');
  const [amount, setAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState(null);
  const [adjusting, setAdjusting] = useState(false);

  const { getItem } = actions;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItem(await getItem(itemId));
    } catch (err) {
      setLoadError(err?.response?.data?.message || 'Could not load this bulk item.');
    } finally {
      setLoading(false);
    }
  }, [getItem, itemId]);

  useEffect(() => {
    if (!isOpen || !itemId) return;
    setItem(null);
    setSubDialog(null);
    setHolderAction(null);
    setConfirmDelete(false);
    setDirection('add');
    setAmount('');
    setAdjustNote('');
    setAdjustError(null);
    load();
  }, [isOpen, itemId, load]);

  const applyUpdate = (updated) => {
    if (updated && typeof updated === 'object' && updated.id) setItem(updated);
    else load();
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    const max = direction === 'remove' ? item.inStock : 100000;
    let error = validateQuantity(amount, { min: 1, max, label: 'Amount' });
    if (error && direction === 'remove' && item.inStock === 0) error = 'Nothing on the shelf to remove';
    setAdjustError(error);
    if (error) return;
    setAdjusting(true);
    try {
      const updated = await actions.adjustStock(item.id, {
        change: adjustmentChange(direction, parseQuantity(amount)),
        note: adjustNote.trim() || undefined,
      });
      applyUpdate(updated);
      setAmount('');
      setAdjustNote('');
    } catch {
      // Toast shown by the hook.
    } finally {
      setAdjusting(false);
    }
  };

  const handleHolderSubmit = async (payload) => {
    const call = holderAction.mode === 'writeoff' ? actions.writeOffStock : actions.returnStock;
    const updated = await call(item.id, payload);
    setHolderAction(null);
    applyUpdate(updated);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await actions.deleteItem(item.id);
      onClose();
    } catch {
      // Toast shown by the hook.
    } finally {
      setDeleting(false);
    }
  };

  if (isOpen && item && subDialog === 'edit') {
    return (
      <StockItemModal
        isOpen
        item={item}
        onClose={() => setSubDialog(null)}
        onSave={async (payload) => applyUpdate(await actions.updateItem(item.id, payload))}
      />
    );
  }

  if (isOpen && item && subDialog === 'assign') {
    return (
      <StockAssignModal
        isOpen
        item={item}
        onClose={() => setSubDialog(null)}
        onAssign={async (payload, name) => applyUpdate(await actions.assignStock(item.id, payload, name))}
      />
    );
  }

  const warning = lowStockText(item);
  const blockedReason = deleteBlockedReason(item);
  const holders = item?.holders || [];
  const history = item?.history || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item?.name || 'Bulk item'} maxWidth="max-w-2xl">
      {loading && !item ? (
        <div className="py-12 flex flex-col items-center gap-3 text-secondary">
          <Loader2 className="w-6 h-6 animate-spin text-accent" aria-hidden="true" />
          <p className="text-sm">Loading…</p>
        </div>
      ) : loadError || !item ? (
        <div role="alert" className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-sm text-danger flex items-center justify-between gap-3">
          <span>{loadError || 'Bulk item not found.'}</span>
          <button type="button" onClick={load} className="underline text-xs cursor-pointer">Retry</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Identity and actions */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Badge badgeChar={item.categoryBadgeChar || item.categoryName || item.name} color={item.categoryColor} title={item.categoryName || 'No category'} />
              <div className="min-w-0 text-sm">
                <p className="text-secondary">
                  {item.categoryName || 'No category'}
                  {item.location && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <MapPin className="w-3.5 h-3.5" aria-hidden="true" />{item.location}
                    </span>
                  )}
                </p>
                {item.notes && <p className="text-xs text-secondary mt-1 whitespace-pre-line break-words">{item.notes}</p>}
                {warning && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />{warning}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {canAssign && (
                <Button
                  size="sm"
                  onClick={() => setSubDialog('assign')}
                  disabled={item.inStock === 0}
                  title={item.inStock === 0 ? 'Nothing in stock to give out' : undefined}
                >
                  <UserPlus className="w-3.5 h-3.5" />Assign
                </Button>
              )}
              {canUpdate && (
                <Button size="sm" variant="secondary" onClick={() => setSubDialog('edit')}>
                  <Pencil className="w-3.5 h-3.5" />Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmDelete(true)}
                  disabled={Boolean(blockedReason)}
                  title={blockedReason || 'Remove this item from the list'}
                  className="text-danger"
                >
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </Button>
              )}
            </div>
          </div>

          {canDelete && blockedReason && (
            <p className="text-xs text-secondary -mt-3">Delete is unavailable: {blockedReason}</p>
          )}

          {confirmDelete && !blockedReason && (
            <div role="alertdialog" aria-labelledby="stock-delete-title" className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 space-y-3">
              <p id="stock-delete-title" className="text-sm text-danger">
                Remove <strong>{item.name}</strong> from the list? The {item.inStock} on the shelf stop being tracked. Its history is kept.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
                <Button size="sm" variant="danger" onClick={handleDelete} loading={deleting}>Delete item</Button>
              </div>
            </div>
          )}

          {/* Summary */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <SummaryTile label="In stock" value={item.inStock} emphasis={warning ? 'text-warning' : 'text-success'} />
            <SummaryTile label="Given out" value={item.givenOut} />
            <SummaryTile label="Total" value={item.totalQuantity} />
            <SummaryTile label="Warn at" value={item.lowStockThreshold ?? '—'} />
            <SummaryTile label="Cost / unit" value={item.costCents == null ? '—' : formatCurrency(item.costCents / 100)} />
            <SummaryTile label="Holders" value={item.holdersCount ?? holders.length} />
          </dl>

          {/* Add or remove stock */}
          {canUpdate && (
            <form onSubmit={handleAdjust} noValidate className="p-3.5 rounded-xl border border-border bg-base/40 space-y-3">
              <h4 className={sectionTitle}>Add or remove stock</h4>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div role="radiogroup" aria-label="Change" className="inline-flex bg-surface border border-border rounded-xl p-1 self-start">
                  {[
                    ['add', 'Delivery', Plus],
                    ['remove', 'Remove', Minus],
                  ].map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={direction === value}
                      onClick={() => { setDirection(value); setAdjustError(null); }}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                        direction === value ? 'bg-accent text-on-accent shadow-sm' : 'text-secondary hover:text-primary'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />{label}
                    </button>
                  ))}
                </div>
                <div className="sm:w-28">
                  <label htmlFor="stock-adjust-amount" className={labelClass}>Amount</label>
                  <input
                    id="stock-adjust-amount"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-invalid={Boolean(adjustError)}
                    aria-describedby={adjustError ? 'stock-adjust-error' : 'stock-adjust-hint'}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <label htmlFor="stock-adjust-note" className={labelClass}>Note (optional)</label>
                  <input
                    id="stock-adjust-note"
                    type="text"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    maxLength={500}
                    placeholder={direction === 'add' ? 'E.g., PO-1042 delivered' : 'E.g., damaged in storage'}
                    className={inputClass}
                  />
                </div>
                <Button type="submit" size="sm" loading={adjusting} className="self-start sm:self-end">Save</Button>
              </div>
              {adjustError
                ? <p id="stock-adjust-error" role="alert" className="text-xs text-danger">{adjustError}</p>
                : (
                  <p id="stock-adjust-hint" className="text-xs text-secondary">
                    {direction === 'add'
                      ? 'A delivery adds to the shelf and the total.'
                      : `Takes units off the shelf (lost or damaged in storage). ${item.inStock} on the shelf.`}
                  </p>
                )}
            </form>
          )}

          {/* Holders */}
          <section className="space-y-3" aria-labelledby="stock-holders-title">
            <h4 id="stock-holders-title" className={`${sectionTitle} border-b border-border/60 pb-2.5`}>
              <Users className="w-4 h-4 text-accent" aria-hidden="true" />
              Who has it ({holders.length})
            </h4>
            {holders.length === 0 ? (
              <p className="text-sm text-secondary py-3">Nobody has any at the moment.</p>
            ) : (
              <ul className="space-y-2">
                {holders.map((holder) => {
                  const open = holderAction?.employeeId === holder.employeeId ? holderAction.mode : null;
                  return (
                    <li key={holder.employeeId} className="p-3 rounded-xl border border-border/80 bg-base/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-primary">{holder.name}</span>
                            <span className="text-sm font-mono font-bold text-accent">× {holder.quantity}</span>
                            {holder.hasLeft && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                                Left company
                              </span>
                            )}
                            {showsWorkModeBadge(holder.workMode) && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-raised text-secondary border border-border">
                                {workModeLabel(holder.workMode)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-secondary truncate">
                            {holder.email}{holder.department ? ` · ${holder.department}` : ''}
                            {holder.firstAssignedAt && ` · since ${formatDate(holder.firstAssignedAt)}`}
                          </p>
                        </div>
                        {!open && (canAssign || canDelete) && (
                          <div className="flex flex-wrap gap-2 shrink-0">
                            {canAssign && (
                              <Button size="sm" variant="secondary" onClick={() => setHolderAction({ employeeId: holder.employeeId, mode: 'return' })}>
                                <Undo2 className="w-3.5 h-3.5" />Return
                              </Button>
                            )}
                            {canDelete && (
                              <Button size="sm" variant="ghost" className="text-error" onClick={() => setHolderAction({ employeeId: holder.employeeId, mode: 'writeoff' })}>
                                <PackageMinus className="w-3.5 h-3.5" />Write off
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {open && (
                        <HolderActionForm
                          holder={holder}
                          mode={open}
                          itemName={item.name}
                          onCancel={() => setHolderAction(null)}
                          onSubmit={handleHolderSubmit}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* History */}
          <section className="space-y-3" aria-labelledby="stock-history-title">
            <h4 id="stock-history-title" className={`${sectionTitle} border-b border-border/60 pb-2.5`}>
              <History className="w-4 h-4 text-accent" aria-hidden="true" />
              History
            </h4>
            {history.length === 0 ? (
              <p className="text-sm text-secondary">No changes recorded yet.</p>
            ) : (
              <ol className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {history.map((event) => {
                  const note = stockEventNote(event);
                  return (
                    <li key={event.id} className="flex gap-3">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TONE_DOT[stockEventTone(event.eventType)]}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-primary">{stockEventLabel(event)}</p>
                        {note && <p className="text-xs text-secondary break-words">{note}</p>}
                        <p className="text-[11px] text-secondary">
                          {formatDateTime(event.createdAt)}{event.performedBy ? ` · by ${event.performedBy}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
