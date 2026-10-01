import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { X, Loader2, Pencil, CheckCircle2, Ban, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFocusTrap from '../../hooks/useFocusTrap';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import OffboardingStatusBadge from './OffboardingStatusBadge';
import OffboardingChecklist from './OffboardingChecklist';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { toDateInputValue } from '../../utils/dates';
import {
  OFFBOARDING_REASONS,
  getReasonLabel,
  isOpenOffboarding,
  getLastDayUrgency,
  getChecklistProgress,
  getCompleteBlocker,
} from '../../utils/offboarding';

const inputClass = 'w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

const InfoCell = ({ label, children }) => (
  <div className="min-w-0">
    <div className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">{label}</div>
    {children}
  </div>
);

const urgencyClass = {
  overdue: 'text-error',
  soon: 'text-warning',
  upcoming: 'text-secondary',
};

/**
 * Details of one offboarding request: summary, editable fields, the asset
 * checklist and the complete / cancel actions. The hook callbacks show the
 * toasts and resolve to the updated request (with items).
 */
const OffboardingDetailsModal = ({ isOpen, onClose, request, getRequestDetails, onUpdate, onResolveItem, onComplete, onCancel }) => {
  const { hasPermission, user } = useAuth();
  const canUpdatePermission = hasPermission('offboarding:update');
  const canCollectPermission = hasPermission('offboarding:collect');
  const canReturnAssets = hasPermission('assets:assign');
  const canWriteOffAssets = hasPermission('assets:delete');
  const canGrantAccess = hasPermission('employees:grant-access');
  const canDeleteEmployees = hasPermission('employees:delete');

  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Edit form
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ lastWorkingDate: '', reason: '', notes: '', revokeAccess: true });
  const [saving, setSaving] = useState(false);

  // Checklist
  const [busyItemId, setBusyItemId] = useState(null);
  const [missingItem, setMissingItem] = useState(null);
  const [missingNotes, setMissingNotes] = useState('');

  // Footer dialogs
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeRevoke, setCompleteRevoke] = useState(true);
  const [completeDeactivate, setCompleteDeactivate] = useState(false);
  const [completing, setCompleting] = useState(false);

  const requestId = request?.id;
  // Responses for a request that is no longer on screen are dropped.
  const currentIdRef = useRef(requestId);
  currentIdRef.current = requestId;
  const showIfCurrent = (updated) => {
    if (updated && String(updated.id) === String(currentIdRef.current)) setFullData(updated);
  };

  const loadFullDetails = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      showIfCurrent(await getRequestDetails(requestId));
    } catch {
      // The hook showed a toast.
    } finally {
      setLoading(false);
    }
  }, [requestId, getRequestDetails]);

  useEffect(() => {
    if (isOpen && requestId) {
      loadFullDetails();
    } else {
      setFullData(null);
    }
    setEditing(false);
    setMissingItem(null);
    setConfirmCancel(false);
    setCompleteOpen(false);
    // Keyed on the id, so a list refresh (new row objects) doesn't reload.
  }, [isOpen, requestId, loadFullDetails]);

  const data = fullData || request;
  // The person leaving can see their exit but not change it.
  const isOwnExit = data && user && String(data.employeeId) === String(user.id);
  const canUpdate = canUpdatePermission && !isOwnExit;
  const canCollect = canCollectPermission && !isOwnExit;
  const isOpenRequest = isOpenOffboarding(data?.status);
  const canEdit = canUpdate && isOpenRequest;
  const items = fullData?.items || [];
  const progress = getChecklistProgress(fullData ? items : data);
  const completeBlocker = fullData ? getCompleteBlocker(fullData) : 'Loading…';
  const urgency = data ? getLastDayUrgency(data.lastWorkingDate, data.status) : null;

  const startEditing = () => {
    setForm({
      lastWorkingDate: toDateInputValue(fullData?.lastWorkingDate),
      reason: fullData?.reason || '',
      notes: fullData?.notes || '',
      revokeAccess: fullData?.revokeAccess !== false,
    });
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.lastWorkingDate) return;
    setSaving(true);
    try {
      const updated = await onUpdate(requestId, {
        lastWorkingDate: form.lastWorkingDate,
        reason: form.reason || null,
        notes: form.notes.trim() || null,
        revokeAccess: form.revokeAccess,
      });
      showIfCurrent(updated);
      setEditing(false);
    } catch {
      // Toast shown by the hook; keep the form open.
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (item, { condition, notes }) => {
    setBusyItemId(item.id);
    try {
      const updated = await onResolveItem(requestId, item.id, { outcome: 'returned', condition, notes });
      showIfCurrent(updated);
    } finally {
      setBusyItemId(null);
    }
  };

  const openMissing = (item) => {
    setMissingNotes('');
    setMissingItem(item);
  };

  const handleConfirmMissing = async () => {
    if (!missingItem) return;
    const item = missingItem;
    setBusyItemId(item.id);
    try {
      const updated = await onResolveItem(requestId, item.id, { outcome: 'missing', notes: missingNotes.trim() || undefined });
      showIfCurrent(updated);
      setMissingItem(null);
    } catch {
      // Toast shown by the hook; keep the dialog open to retry.
    } finally {
      setBusyItemId(null);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const updated = await onCancel(requestId);
      showIfCurrent(updated);
      setConfirmCancel(false);
      setEditing(false);
    } catch {
      // Toast shown by the hook.
    } finally {
      setCancelling(false);
    }
  };

  const openComplete = () => {
    setCompleteRevoke(Boolean(fullData?.revokeAccess) && canGrantAccess);
    setCompleteDeactivate(false);
    setCompleteOpen(true);
  };

  const handleConfirmComplete = async () => {
    setCompleting(true);
    try {
      const payload = {
        // Without a login (or without the right to revoke) nothing is
        // revoked; say so explicitly so the request's default isn't used.
        revokeAccess: Boolean(fullData?.employeeHasLogin && canGrantAccess && completeRevoke),
      };
      if (canDeleteEmployees && completeDeactivate) payload.deactivateEmployee = true;
      const updated = await onComplete(requestId, payload);
      showIfCurrent(updated);
      setCompleteOpen(false);
      setEditing(false);
    } catch {
      // Toast shown by the hook (e.g. items still pending, last Director).
    } finally {
      setCompleting(false);
    }
  };

  const dialogRef = useRef(null);
  const titleId = useId();
  const idPrefix = useId();
  const field = (name) => `${idPrefix}-${name}`;
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen && !!request, onClose);

  if (!isOpen || !request) return null;

  const missingIsClient = missingItem?.assetType === 'client';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-primary truncate">
              Offboarding: {data.employeeName || `#${request.id}`}
            </h2>
            {data.status && <OffboardingStatusBadge status={data.status} />}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && !fullData ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : fullData ? (
            <div className="space-y-6">

              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-base p-4 rounded-lg border border-border">
                <InfoCell label="Employee">
                  <div className="text-sm font-semibold text-primary break-words">{fullData.employeeName}</div>
                  {fullData.employeeEmail && <div className="text-xs text-secondary mt-0.5 break-all">{fullData.employeeEmail}</div>}
                  {fullData.employeeDeleted && <div className="text-xs text-secondary italic mt-0.5">Removed from directory</div>}
                </InfoCell>
                <InfoCell label="Department">
                  <div className="text-sm text-primary">{fullData.employeeDepartment || '—'}</div>
                </InfoCell>
                <InfoCell label="Last Working Day">
                  <div className="text-sm text-primary font-medium">{formatDate(fullData.lastWorkingDate)}</div>
                  {urgency && urgency.tone !== 'upcoming' && (
                    <div className={`text-xs font-medium mt-0.5 ${urgencyClass[urgency.tone]}`}>{urgency.label}</div>
                  )}
                </InfoCell>
                <InfoCell label="Reason">
                  <div className="text-sm text-primary">{getReasonLabel(fullData.reason) || '—'}</div>
                </InfoCell>
                <InfoCell label="Requested By">
                  <div className="text-sm text-primary break-words">{fullData.requestedByName || '—'}</div>
                  {fullData.createdAt && <div className="text-xs text-secondary mt-0.5">{formatDate(fullData.createdAt)}</div>}
                </InfoCell>
                <InfoCell label="Login Access">
                  <div className="text-sm text-primary">
                    {!fullData.employeeHasLogin
                      ? 'No login'
                      : fullData.revokeAccess ? 'Revoke on completion' : 'Keep'}
                  </div>
                </InfoCell>
                {fullData.status === 'completed' && (
                  <InfoCell label="Completed">
                    <div className="text-sm text-primary break-words">{fullData.completedByName || '—'}</div>
                    {fullData.completedAt && <div className="text-xs text-secondary mt-0.5">{formatDateTime(fullData.completedAt)}</div>}
                  </InfoCell>
                )}
              </div>

              {/* Edit form / notes */}
              {editing ? (
                <form onSubmit={handleSave} className="space-y-4 p-4 rounded-lg border border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor={field('date')} className="text-sm font-medium text-primary">Last working day <span className="text-error">*</span></label>
                      <input
                        id={field('date')}
                        type="date"
                        required
                        value={form.lastWorkingDate}
                        onChange={(e) => setForm(f => ({ ...f, lastWorkingDate: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={field('reason')} className="text-sm font-medium text-primary">Reason</label>
                      <select
                        id={field('reason')}
                        value={form.reason}
                        onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Not specified</option>
                        {OFFBOARDING_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={field('notes')} className="text-sm font-medium text-primary">Notes</label>
                    <textarea
                      id={field('notes')}
                      rows={3}
                      maxLength={2000}
                      value={form.notes}
                      onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  {fullData.employeeHasLogin && (
                    <div className="flex items-start gap-3">
                      <input
                        id={field('revoke')}
                        type="checkbox"
                        checked={form.revokeAccess}
                        onChange={(e) => setForm(f => ({ ...f, revokeAccess: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 rounded text-accent border-border focus:ring-accent cursor-pointer"
                      />
                      <label htmlFor={field('revoke')} className="text-sm text-primary cursor-pointer">Revoke login access when completed</label>
                    </div>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                    <Button type="submit" size="sm" loading={saving} disabled={!form.lastWorkingDate}>Save changes</Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-medium text-secondary uppercase tracking-wider">Notes</h3>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={startEditing}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded-md transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit details
                      </button>
                    )}
                  </div>
                  {fullData.notes ? (
                    <div className="text-sm text-primary bg-base p-3 rounded-lg border border-border whitespace-pre-wrap break-words">{fullData.notes}</div>
                  ) : (
                    <p className="text-sm text-secondary italic">No notes.</p>
                  )}
                </div>
              )}

              <hr className="border-border" />

              {/* Checklist */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="text-sm font-semibold text-primary">Assets to collect</h3>
                  {progress.total > 0 && (
                    <div className="flex items-center gap-2 text-xs text-secondary">
                      <span>{progress.collected} of {progress.total} collected</span>
                      <div className="w-24 h-1.5 rounded-full bg-raised overflow-hidden" aria-hidden="true">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {canCollect && isOpenRequest && progress.total > 0 && (
                  <p className="flex items-start gap-2 text-xs text-secondary mb-3">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Returned assets go back to stock (client assets go back to the client); accessories return with their asset. Missing assets are retired.</span>
                  </p>
                )}
                <OffboardingChecklist
                  items={items}
                  canCollect={canCollect && isOpenRequest}
                  canReturn={canReturnAssets}
                  canWriteOff={canWriteOffAssets}
                  busyItemId={busyItemId}
                  onReturn={handleReturn}
                  onRequestMissing={openMissing}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-border bg-base/50 shrink-0">
          {canEdit && fullData ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <Button variant="secondary" onClick={() => setConfirmCancel(true)} className="text-error">
                <Ban className="w-4 h-4" />
                Cancel offboarding
              </Button>
              <Button
                variant="primary"
                onClick={openComplete}
                disabled={!!completeBlocker}
                title={completeBlocker || undefined}
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete
              </Button>
            </div>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-on-accent bg-secondary hover:bg-secondary/90 rounded-lg shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
        {canEdit && fullData && completeBlocker && (
          <p className="px-6 pb-3 -mt-2 bg-base/50 text-xs text-secondary">{completeBlocker}</p>
        )}
      </div>

      {/* Missing confirmation */}
      <Modal
        isOpen={!!missingItem}
        onClose={busyItemId ? () => {} : () => setMissingItem(null)}
        title="Report asset missing"
        maxWidth="max-w-md"
      >
        {missingItem && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Report <strong className="text-primary">{missingItem.assetName}</strong>
              {missingItem.serialNumber ? ` (${missingItem.serialNumber})` : ''} as not returned?
              {missingIsClient
                ? ' The client asset will be marked missing and retired.'
                : ' The asset will be retired and removed from available stock.'}
              {' '}Accessories attached to it stay on the checklist. This can't be undone from the checklist.
            </p>
            <div className="space-y-2">
              <label htmlFor={field('missing-notes')} className="text-sm font-medium text-primary">Note (optional)</label>
              <textarea
                id={field('missing-notes')}
                rows={2}
                maxLength={1000}
                value={missingNotes}
                onChange={(e) => setMissingNotes(e.target.value)}
                placeholder="e.g. employee says it was lost"
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button variant="secondary" onClick={() => setMissingItem(null)} disabled={!!busyItemId}>Cancel</Button>
              <Button variant="danger" onClick={handleConfirmMissing} loading={!!busyItemId}>
                <AlertTriangle className="w-4 h-4" />
                <span>Report missing</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel confirmation */}
      <Modal
        isOpen={confirmCancel}
        onClose={cancelling ? () => {} : () => setConfirmCancel(false)}
        title="Cancel offboarding"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Cancel the offboarding of <strong className="text-primary">{data.employeeName}</strong>? They stay an active
            employee with their remaining assets and login. Assets already marked returned or missing stay that way.
          </p>
          <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)} disabled={cancelling}>Keep it open</Button>
            <Button variant="danger" onClick={handleConfirmCancel} loading={cancelling}>
              <Ban className="w-4 h-4" />
              <span>Cancel offboarding</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete confirmation */}
      <Modal
        isOpen={completeOpen}
        onClose={completing ? () => {} : () => setCompleteOpen(false)}
        title="Complete offboarding"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            All assets of <strong className="text-primary">{data.employeeName}</strong> are accounted for. Completing closes this offboarding.
          </p>
          {fullData?.employeeHasLogin && (
            <div className="flex items-start gap-3">
              <input
                id={field('complete-revoke')}
                type="checkbox"
                checked={completeRevoke}
                disabled={!canGrantAccess}
                onChange={(e) => setCompleteRevoke(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-accent border-border focus:ring-accent cursor-pointer disabled:cursor-not-allowed"
              />
              <label htmlFor={field('complete-revoke')} className={`text-sm ${canGrantAccess ? 'text-primary cursor-pointer' : 'text-secondary'}`}>
                Revoke login access
                <span className="block text-xs text-secondary mt-0.5">
                  {canGrantAccess
                    ? 'They are signed out and can no longer sign in.'
                    : "You don't have permission to manage login access. Administrators will be reminded to revoke it."}
                </span>
              </label>
            </div>
          )}
          {canDeleteEmployees && (
            <div className="flex items-start gap-3">
              <input
                id={field('complete-deactivate')}
                type="checkbox"
                checked={completeDeactivate}
                onChange={(e) => setCompleteDeactivate(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-accent border-border focus:ring-accent cursor-pointer"
              />
              <label htmlFor={field('complete-deactivate')} className="text-sm text-primary cursor-pointer">
                Remove from employee directory
                <span className="block text-xs text-secondary mt-0.5">Their history is kept; they no longer appear in the directory.</span>
              </label>
            </div>
          )}
          <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button variant="secondary" onClick={() => setCompleteOpen(false)} disabled={completing}>Back</Button>
            <Button variant="primary" onClick={handleConfirmComplete} loading={completing}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete offboarding</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OffboardingDetailsModal;
