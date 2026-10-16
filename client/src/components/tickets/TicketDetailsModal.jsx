import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Package, ArrowRightLeft, History, AlertCircle, AlertTriangle, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getAvailableAssets } from '../../api/assetsApi';
import { ticketsApi } from '../../api/ticketsApi';
import { formatDateTime } from '../../utils/formatters';
import { canWorkTicket, getTicketStatusOptions, TICKET_STATUS_LABELS } from '../../utils/ticketStatus';
import TicketStatusBadge, { PriorityBadge, TicketAgeBadge, TicketTypeBadge } from './TicketStatusBadge';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Select, Textarea } from '../ui/Field';
import { PRIORITIES, queueLabel, historyEventLabel, historyEventActor, ticketRef } from '../../utils/ticketMeta';

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

function Detail({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm text-primary break-words">{children}</dd>
    </div>
  );
}

// Actions come from the page that owns the ticket list (useTickets there), so
// a change made here shows up in that list straight away.
//   onUpdate(id, payload), onTransfer(id, targetAdminType, note),
//   onConfirmClose(id), onReopen(ticket) — onReopen may open a reason prompt.
const TicketDetailsModal = ({ isOpen, onClose, ticket, onUpdate, onTransfer, onConfirmClose, onReopen }) => {
  const { user, hasPermission } = useAuth();
  const isTicketOwner = user?.id != null && ticket?.employee_id != null
    && String(user.id) === String(ticket.employee_id);
  const canResolve = hasPermission('tickets:resolve');
  const canOpenAssets = hasPermission('assets:read');
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

  if (!ticket) return null;

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
    <div className="pt-3 flex flex-wrap items-center justify-end gap-3">
      {onReopen && (
        <Button variant="ghost" onClick={() => onReopen(ticket)} disabled={submitting}>
          Reopen Ticket
        </Button>
      )}
      <Button
        variant="success"
        onClick={() => runAction(() => onConfirmClose(ticket.id), 'Failed to close ticket')}
        disabled={!onConfirmClose}
        loading={submitting}
      >
        <Check className="w-4 h-4" aria-hidden="true" />
        Confirm Resolution
      </Button>
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
    if (type === 'escalated') return <AlertTriangle className="w-3 h-3 text-on-accent" />;
    if (type === 'transferred') return <ArrowRightLeft className="w-3 h-3 text-on-accent" />;
    if (type === 'resolved' || type === 'rejected' || type === 'closed') return <Check className="w-3 h-3 text-on-accent" />;
    return <History className="w-3 h-3 text-on-accent" />;
  };

  const requester = ticket.employee_name || (isTicketOwner ? user?.name : null);

  const footer = isHandlingAdmin ? (
    <Button type="submit" form="resolve-form" loading={submitting}>
      {inTransferMode ? <ArrowRightLeft className="w-4 h-4" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
      {inTransferMode ? 'Confirm Transfer' : 'Save Changes'}
    </Button>
  ) : (
    <Button variant="secondary" onClick={onClose}>Close</Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={<span className="font-mono">{ticketRef(ticket)}</span>}
      headerExtra={(
        <div className="flex flex-wrap items-center gap-1.5">
          <TicketStatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <TicketAgeBadge ticket={ticket} />
        </div>
      )}
      footer={footer}
    >
      <div className="space-y-6">
        {/* What the ticket is, and who raised it */}
        <section aria-label="Ticket details" className="space-y-4">
          <div>
            <p className="text-lg text-primary font-semibold break-words">{ticket.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <TicketTypeBadge type={ticket.type} />
              <span className="text-xs text-secondary">Raised {formatDateTime(ticket.created_at)}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-base/60 border border-border/60 rounded-lg p-3">
            <span className="w-9 h-9 rounded-full bg-raised flex items-center justify-center text-secondary shrink-0" aria-hidden="true">
              <UserRound className="w-4.5 h-4.5" />
            </span>
            <dl className="min-w-0">
              <dt className="text-xs font-medium text-secondary uppercase tracking-wider">Raised by</dt>
              <dd className="text-sm text-primary font-medium break-words">
                {requester || `Employee #${ticket.employee_id}`}
                {isTicketOwner && <span className="text-secondary font-normal"> (you)</span>}
              </dd>
              {(ticket.employee_email || ticket.employee_department) && (
                <dd className="text-xs text-secondary break-words">
                  {[ticket.employee_email, ticket.employee_department].filter(Boolean).join(' · ')}
                </dd>
              )}
            </dl>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Detail label="Department">{queueLabel(ticket.current_admin_type)}</Detail>
            {ticket.type === 'request' && (ticket.category_name || ticket.requested_item) && (
              <Detail label="Needs">
                {ticket.category_name || ticket.requested_item}
                {!ticket.category_name && <span className="text-xs text-secondary"> (typed in)</span>}
              </Detail>
            )}
            {ticket.asset_name && (
              <Detail label="Related device">
                {canOpenAssets && ticket.asset_id ? (
                  <Link to={`/inventory/${ticket.asset_id}`} onClick={onClose} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                    <Package className="w-4 h-4 shrink-0" aria-hidden="true" /> {ticket.asset_name}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" /> {ticket.asset_name}
                  </span>
                )}
              </Detail>
            )}
          </dl>

          {ticket.description && (
            <Detail label="Description">
              <span className="block bg-base rounded-lg p-3 border border-border whitespace-pre-wrap">{ticket.description}</span>
            </Detail>
          )}
        </section>

        {/* Owner confirm/reopen for a resolved ticket they can also work */}
        {isHandlingAdmin && showOwnerActions && (
          <div className="space-y-2 bg-accent/5 border border-accent/15 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-accent">Your Ticket Was Resolved</h3>
            {ticket.resolution_notes && <p className="text-sm text-primary">{ticket.resolution_notes}</p>}
            {ownerActions}
          </div>
        )}

        {/* Working the ticket comes before the history, so it's in reach. */}
        {isHandlingAdmin ? (
          <form id="resolve-form" onSubmit={handleSubmit} className="space-y-4 border-t border-border pt-5">
            {!inTransferMode ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-primary">Work on This Ticket</h3>
                  {canTransfer && canUpdate && (
                    <Button variant="ghost" size="sm" onClick={() => { setShowTransferMode(true); setFormError(null); }}>
                      <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      Transfer
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field id="ticket-status" label="Status" hint={!canResolve ? 'Resolving or rejecting needs the Resolve Tickets permission.' : undefined}>
                    <Select value={status} onChange={(e) => { setStatus(e.target.value); setFormError(null); }}>
                      {/* Only the moves the server allows from the current status */}
                      {statusOptions.map(value => (
                        <option key={value} value={value}>{TICKET_STATUS_LABELS[value] || value}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="ticket-priority" label="Priority">
                    <Select value={priority} onChange={(e) => { setPriority(e.target.value); setFormError(null); }}>
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {showAssetPicker && (
                  <Field
                    id="ticket-resolved-asset"
                    label="Hand out an asset (optional)"
                    hint="The selected asset is assigned to the requester when you save."
                    labelAction={loadingAssets ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" aria-label="Loading assets" /> : null}
                  >
                    <Select value={resolvedAssetId} onChange={(e) => { setResolvedAssetId(e.target.value); setFormError(null); }}>
                      <option value="">No asset</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field id="ticket-resolution-notes" label="Resolution notes (optional)">
                  <Textarea
                    rows={3}
                    maxLength={2000}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Explain how this was resolved…"
                  />
                </Field>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-primary">Transfer Ticket</h3>
                  {!transferOnly && (
                    <Button variant="ghost" size="sm" onClick={() => { setShowTransferMode(false); setFormError(null); }}>
                      Cancel Transfer
                    </Button>
                  )}
                </div>
                <Field id="ticket-transfer-to" label="Transfer to" required>
                  <Select value={targetAdminType} onChange={(e) => setTargetAdminType(e.target.value)}>
                    <option value="" disabled>Select department…</option>
                    {['it', 'hardware', 'hr'].filter((queue) => queue !== ticket.current_admin_type).map((queue) => (
                      <option key={queue} value={queue}>{queueLabel(queue)}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="ticket-transfer-note" label="Reason" required>
                  <Textarea
                    rows={3}
                    maxLength={1000}
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Explain why this ticket is being transferred…"
                  />
                </Field>
              </>
            )}
          </form>
        ) : (
          // Employee view of the resolution
          ticket.status !== 'open' && (
            <div className="space-y-2 bg-accent/5 border border-accent/15 rounded-lg p-4">
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
            This ticket is in the {queueLabel(ticket.current_admin_type)} queue; only that team or a Director can update it.
          </p>
        )}

        {formError && (
          <div role="alert" className="flex items-start gap-2 bg-error/10 border border-error/20 text-error rounded-lg p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {/* History */}
        <section aria-labelledby="ticket-timeline-title" className="border-t border-border pt-5">
          <h3 id="ticket-timeline-title" className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-accent" aria-hidden="true" /> Timeline
          </h3>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-secondary text-sm">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading timeline…
            </div>
          ) : (
            <ol className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-raised">
              {history.map(event => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-border shadow bg-secondary" aria-hidden="true">
                    {getEventIcon(event.event_type)}
                  </span>
                  <div className="bg-base/60 p-3 rounded-lg border border-border/60 text-sm min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 mb-1">
                      <span className="font-semibold text-primary">{historyEventLabel(event)}</span>
                      <span className="text-xs text-secondary shrink-0" title={event.created_at}>
                        {formatDateTime(event.created_at)}
                      </span>
                    </div>
                    {event.event_type === 'transferred' && (
                      <p className="text-secondary text-xs mb-1">
                        From <span className="font-medium">{queueLabel(event.from_admin_type)}</span> → <span className="font-medium">{queueLabel(event.to_admin_type)}</span>
                      </p>
                    )}
                    {event.note && <p className="text-primary italic mt-1 bg-surface p-2 rounded break-words">{event.note}</p>}
                    <p className="text-xs text-secondary mt-1">By: {historyEventActor(event)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default TicketDetailsModal;
