import React, { useState, useEffect, useRef, useId } from 'react';
import { X, Check, Loader2, Package, ArrowRightLeft, History, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getAvailableAssets } from '../../api/assetsApi';
import { ticketsApi } from '../../api/ticketsApi';
import { formatDateTime } from '../../utils/formatters';
import { canWorkTicket, getTicketStatusOptions, TICKET_STATUS_LABELS } from '../../utils/ticketStatus';
import { TicketAgeBadge } from './TicketStatusBadge';
import useFocusTrap from '../../hooks/useFocusTrap';
import { PRIORITIES, priorityLabel, priorityStyle, queueLabel } from '../../utils/ticketMeta';

const StatusBadge = ({ status }) => {
  const styles = {
    open: 'bg-error/10 text-error border-error/20',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    resolved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-raised text-secondary border-border',
    closed: 'bg-secondary/10 text-secondary border-secondary/20'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

// Actions come from the page that owns the ticket list (useTickets there), so
// a change made here shows up in that list straight away.
//   onUpdate(id, payload), onTransfer(id, targetAdminType, note),
//   onConfirmClose(id), onReopen(ticket) — onReopen may open a reason prompt.
const TicketDetailsModal = ({ isOpen, onClose, ticket, onUpdate, onTransfer, onConfirmClose, onReopen }) => {
  const { user, hasPermission } = useAuth();
  const isTicketOwner = user?.id != null && ticket?.employee_id != null
    && String(user.id) === String(ticket.employee_id);
  const canResolve = hasPermission('tickets:resolve');
  // Only the queue that holds the ticket (or a Director) may work it.
  const canWork = canWorkTicket(user, ticket);
  const canUpdate = canWork && hasPermission('tickets:update') && !!onUpdate;
  const canTransfer = canWork && canResolve && !!onTransfer;
  const isHandlingAdmin = canUpdate || canTransfer;
  // Someone who may transfer but not edit only gets the transfer form.
  const transferOnly = canTransfer && !canUpdate;

  const [status, setStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedAssetId, setResolvedAssetId] = useState('');
  const [priority, setPriority] = useState('medium');

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [transferNote, setTransferNote] = useState('');
  const [showTransferMode, setShowTransferMode] = useState(false);
  const [targetAdminType, setTargetAdminType] = useState('');

  const ticketId = ticket?.id;

  useEffect(() => {
    if (!isOpen || !ticket) return;
    setStatus(ticket.status);
    setPriority(ticket.priority || 'medium');
    setResolutionNotes(ticket.resolution_notes || '');
    setResolvedAssetId('');
    setShowTransferMode(false);
    setTransferNote('');
    setTargetAdminType('');
    setFormError(null);
  }, [isOpen, ticket]);

  useEffect(() => {
    if (!isOpen || !ticketId) return undefined;
    let cancelled = false;
    setLoadingHistory(true);
    ticketsApi.getHistory(ticketId)
      .then(data => { if (!cancelled) setHistory(data || []); })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
          toast.error('Failed to load ticket history');
        }
      })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [isOpen, ticketId]);

  // Fulfilling a request hands out an in-stock company asset, so the picker
  // only appears (and only loads) when the admin is choosing Resolved.
  const isChoosingResolved = !!ticket && status === 'resolved' && ticket.status !== 'resolved';
  const showAssetPicker = isChoosingResolved && ticket?.type === 'request';

  useEffect(() => {
    if (!showAssetPicker) return undefined;
    let cancelled = false;
    setLoadingAssets(true);
    getAvailableAssets()
      .then(res => { if (!cancelled) setAssets(res.data?.data || []); })
      .catch(err => {
        if (!cancelled) setFormError(errorMessage(err, 'Could not load available assets'));
      })
      .finally(() => { if (!cancelled) setLoadingAssets(false); });
    return () => { cancelled = true; };
  }, [showAssetPicker]);

  const dialogRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen && !!ticket, onClose);

  if (!isOpen || !ticket) return null;

  const statusOptions = getTicketStatusOptions(ticket.status, canResolve);
  const inTransferMode = showTransferMode || transferOnly;

  // Runs a ticket action; server refusals (400/403/409) stay visible in the
  // modal so the admin can adjust and retry.
  const runAction = async (action, fallback) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, fallback));
    } finally {
      setSubmitting(false);
    }
  };

  // The person who raised the ticket confirms or reopens it once resolved,
  // even when they could also work it (e.g. a Director's own ticket).
  const showOwnerActions = ticket.status === 'resolved' && isTicketOwner;
  const ownerActions = (
    <div className="pt-4 border-t border-accent/10 flex items-center justify-end gap-3 mt-4">
      {onReopen && (
        <button
          type="button"
          onClick={() => onReopen(ticket)}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-base/50 rounded-lg transition-colors cursor-pointer"
        >
          Reopen Ticket
        </button>
      )}
      <button
        type="button"
        onClick={() => runAction(() => onConfirmClose(ticket.id), 'Failed to close ticket')}
        disabled={submitting || !onConfirmClose}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-success hover:bg-success/90 rounded-lg shadow-sm transition-colors cursor-pointer"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Confirm Resolution
      </button>
    </div>
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    if (inTransferMode) {
      if (!targetAdminType) return;
      runAction(() => onTransfer(ticket.id, targetAdminType, transferNote), 'Failed to transfer ticket');
      return;
    }

    const payload = {
      status,
      resolutionNotes: resolutionNotes || null,
    };
    // Only sent when changed, so an unchanged ticket keeps its priority.
    if (priority && priority !== (ticket.priority || 'medium')) payload.priority = priority;
    // Only send an asset when fulfilling now; leaving it out keeps whatever
    // the ticket already records.
    if (showAssetPicker && resolvedAssetId) {
      payload.resolvedAssetId = parseInt(resolvedAssetId, 10);
    }
    runAction(() => onUpdate(ticket.id, payload), 'Failed to update ticket');
  };

  const getEventIcon = (type) => {
    if (type === 'created') return <Package className="w-3 h-3 text-on-accent" />;
    if (type === 'transferred') return <ArrowRightLeft className="w-3 h-3 text-on-accent" />;
    if (type === 'resolved' || type === 'rejected' || type === 'closed') return <Check className="w-3 h-3 text-on-accent" />;
    return <History className="w-3 h-3 text-on-accent" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-base/75 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-scaleUp flex flex-col max-h-[90dvh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <div className="flex items-center gap-3">
            <h2 id={titleId} className="text-lg font-semibold text-primary">Ticket #{ticket.id}</h2>
            <StatusBadge status={ticket.status} />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priorityStyle(ticket.priority)}`}>
              {priorityLabel(ticket.priority)}<span className="sr-only"> priority</span>
            </span>
            <TicketAgeBadge ticket={ticket} />
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2.5 sm:p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Read Only Ticket Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-secondary uppercase tracking-wider mb-1">Title</h3>
              <p className="text-base text-primary font-medium">{ticket.title}</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Type</h3>
                <p className="text-sm text-primary capitalize">{ticket.type}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Date</h3>
                <p className="text-sm text-primary">{formatDateTime(ticket.created_at)}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Department</h3>
                <p className="text-sm text-primary">{queueLabel(ticket.current_admin_type)}</p>
              </div>
              {ticket.type === 'request' && (ticket.category_name || ticket.requested_item) && (
                <div>
                  <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Needs</h3>
                  <p className="text-sm text-primary break-words">
                    {ticket.category_name || ticket.requested_item}
                    {!ticket.category_name && <span className="text-xs text-secondary"> (typed in)</span>}
                  </p>
                </div>
              )}
            </div>

            {ticket.description && (
              <div>
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Description</h3>
                <div className="bg-base rounded-lg p-3 border border-border overflow-hidden">
                  <p className="text-sm text-primary whitespace-pre-wrap break-words">{ticket.description}</p>
                </div>
              </div>
            )}
            
            {ticket.asset_name && (
              <div>
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Related Device</h3>
                <p className="text-sm text-primary flex items-center gap-2">
                  <Package className="w-4 h-4 text-secondary" />
                  {ticket.asset_name}
                </p>
              </div>
            )}
          </div>

          <hr className="border-border" />

          {/* History Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-accent" /> Ticket Timeline
            </h3>
            {loadingHistory ? (
              <div className="flex items-center gap-2 text-secondary text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading timeline...
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-raised">
                {history.map(event => (
                  <div key={event.id} className="relative group">
                    <span className="absolute -left-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-border shadow bg-secondary">
                      {getEventIcon(event.event_type)}
                    </span>
                    <div className="bg-base/60 p-3 rounded-lg border border-border/60 group-hover:border-border transition-colors text-sm min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 mb-1">
                        <span className="font-semibold text-primary capitalize">{event.event_type.replace('_', ' ')}</span>
                        <span className="text-xs text-secondary shrink-0" title={event.created_at}>
                          {formatDateTime(event.created_at)}
                        </span>
                      </div>
                      {event.event_type === 'transferred' && (
                        <p className="text-secondary text-xs mb-1">
                          From <span className="font-medium">{queueLabel(event.from_admin_type)}</span> → <span className="font-medium">{queueLabel(event.to_admin_type)}</span>
                        </p>
                      )}
                      {event.note && <p className="text-primary italic mt-1 bg-surface p-2 rounded">{event.note}</p>}
                      <p className="text-xs text-secondary mt-1">
                        By: {event.performed_by_name || 'System'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-border" />

          {/* Owner confirm/reopen for a resolved ticket they can also work */}
          {isHandlingAdmin && showOwnerActions && (
            <div className="space-y-2 bg-accent/5 border border-accent/10 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-accent">Your ticket was resolved</h3>
              {ticket.resolution_notes && <p className="text-sm text-primary">{ticket.resolution_notes}</p>}
              {ownerActions}
            </div>
          )}

          {/* Resolution / Transfer Area */}
          {isHandlingAdmin ? (
            <form id="resolve-form" onSubmit={handleSubmit} className="space-y-4">
              
              {!inTransferMode ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">Admin Resolution</h3>
                    {canTransfer && canUpdate && (
                      <button 
                        type="button" 
                        onClick={() => { setShowTransferMode(true); setFormError(null); }}
                        className="text-xs font-medium text-accent hover:text-accent/80 flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        Transfer Ticket
                      </button>
                    )}
                  </div>
              
              <div className="space-y-2">
                <label htmlFor="ticket-status" className="text-sm font-medium text-primary">Status</label>
                <select
                  id="ticket-status"
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setFormError(null); }}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  {/* Only the moves the server allows from the current status */}
                  {statusOptions.map(value => (
                    <option key={value} value={value}>{TICKET_STATUS_LABELS[value] || value}</option>
                  ))}
                </select>
                {!canResolve && (
                  <p className="text-xs text-secondary">Resolving or rejecting needs the Resolve Tickets permission.</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="ticket-priority" className="text-sm font-medium text-primary">Priority</label>
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(e) => { setPriority(e.target.value); setFormError(null); }}
                  disabled={ticket.status === 'closed'}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {showAssetPicker && (
                <div className="space-y-2">
                  <label htmlFor="ticket-resolved-asset" className="text-sm font-medium text-primary flex items-center gap-2">
                    Fulfill Request (Select Available Asset)
                    {loadingAssets && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
                  </label>
                  <select
                    id="ticket-resolved-asset"
                    value={resolvedAssetId}
                    onChange={(e) => { setResolvedAssetId(e.target.value); setFormError(null); }}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">-- No asset selected --</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>
                    ))}
                  </select>
                  <p className="text-xs text-secondary">The selected asset is assigned to the requester when you save.</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="ticket-resolution-notes" className="text-sm font-medium text-primary">Resolution Notes (Optional)</label>
                <textarea
                  id="ticket-resolution-notes"
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Explain how this was resolved..."
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">
                  Transfer Ticket
                </h3>
                {!transferOnly && (
                  <button 
                    type="button" 
                    onClick={() => { setShowTransferMode(false); setFormError(null); }}
                    className="text-xs font-medium text-secondary hover:text-primary cursor-pointer"
                  >
                    Cancel Transfer
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="ticket-transfer-to" className="text-sm font-medium text-primary">Transfer To</label>
                <select
                  id="ticket-transfer-to"
                  required
                  value={targetAdminType}
                  onChange={(e) => setTargetAdminType(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="" disabled>Select department...</option>
                  {ticket.current_admin_type !== 'it' && <option value="it">{queueLabel('it')}</option>}
                  {ticket.current_admin_type !== 'hardware' && <option value="hardware">{queueLabel('hardware')}</option>}
                  {ticket.current_admin_type !== 'hr' && <option value="hr">{queueLabel('hr')}</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="ticket-transfer-note" className="text-sm font-medium text-primary">Transfer Reason / Note</label>
                <textarea
                  id="ticket-transfer-note"
                  rows={3}
                  required
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Explain why this ticket is being transferred..."
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </>
          )}
        </form>
          ) : (
            // Employee View of Resolution
            ticket.status !== 'open' && (
              <div className="space-y-4 bg-accent/5 border border-accent/10 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-accent">Resolution Details</h3>
                {ticket.resolution_notes ? (
                  <p className="text-sm text-primary">{ticket.resolution_notes}</p>
                ) : (
                  <p className="text-sm text-secondary italic">No notes provided.</p>
                )}
                
                {showOwnerActions && ownerActions}
              </div>
            )
          )}

          {!isHandlingAdmin && hasPermission('tickets:update') && ticket.status !== 'closed' && (
            <p className="text-xs text-secondary">
              This ticket is in the {(ticket.current_admin_type || '').toUpperCase()} queue; only that team or a Director can update it.
            </p>
          )}

          {formError && (
            <div role="alert" className="flex items-start gap-2 bg-error/10 border border-error/20 text-error rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-base/50 shrink-0">
          {isHandlingAdmin && (
            <button
              form="resolve-form"
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (inTransferMode ? <ArrowRightLeft className="w-4 h-4" /> : <Check className="w-4 h-4" />)}
              {inTransferMode ? 'Confirm Transfer' : 'Save Changes'}
            </button>
          )}
          {!isHandlingAdmin && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent/90 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
