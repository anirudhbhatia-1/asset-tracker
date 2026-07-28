import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Package, Search, ArrowRightLeft, History } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAssets } from '../../api/assetsApi';
import { useTickets } from '../../hooks/useTickets';
import { formatDistanceToNow } from 'date-fns';

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

const TicketDetailsModal = ({ isOpen, onClose, ticket, onUpdate }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'hr';
  
  const [status, setStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedAssetId, setResolvedAssetId] = useState('');
  
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const { transferTicket, fetchTicketHistory, confirmTicket } = useTickets();
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [transferNote, setTransferNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransferMode, setShowTransferMode] = useState(false);
  const [targetAdminType, setTargetAdminType] = useState('');

  useEffect(() => {
    if (isOpen && ticket) {
      setStatus(ticket.status);
      setResolutionNotes(ticket.resolution_notes || '');
      setResolvedAssetId(ticket.resolved_asset_id || '');
      setShowTransferMode(false);
      setTransferNote('');
      setTargetAdminType('');
      
      loadHistory();

      if (isAdmin && ticket.type === 'request' && ticket.status !== 'resolved') {
        loadAssets();
      }
    }
  }, [isOpen, ticket, isAdmin]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchTicketHistory(ticket.id);
      setHistory(data || []);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await getAssets({ status: 'available' });
      setAssets(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Failed to load assets', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (showTransferMode) {
      if (!targetAdminType) {
        setSubmitting(false);
        return;
      }
      try {
        await transferTicket(ticket.id, targetAdminType, transferNote);
        onClose();
      } finally {
        setSubmitting(false);
      }
      return;
    }
    
    const payload = {
      status,
      resolutionNotes: resolutionNotes || null,
      resolvedAssetId: resolvedAssetId ? parseInt(resolvedAssetId, 10) : null
    };

    try {
      await onUpdate(ticket.id, payload);
      onClose();
    } catch (err) {
      // Handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  const getEventIcon = (type) => {
    if (type === 'created') return <Package className="w-3 h-3 text-white" />;
    if (type === 'transferred') return <ArrowRightLeft className="w-3 h-3 text-white" />;
    if (type === 'resolved' || type === 'rejected' || type === 'closed') return <Check className="w-3 h-3 text-white" />;
    return <History className="w-3 h-3 text-white" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-primary">Ticket #{ticket.id}</h2>
            <StatusBadge status={ticket.status} />
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
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
                <p className="text-sm text-primary">{new Date(ticket.created_at).toLocaleDateString()}</p>
              </div>
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
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {event.event_type === 'transferred' && (
                        <p className="text-secondary text-xs mb-1">
                          From <span className="uppercase font-medium">{event.from_admin_type}</span> → <span className="uppercase font-medium">{event.to_admin_type}</span>
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

          {/* Resolution / Transfer Area */}
          {isAdmin ? (
            <form id="resolve-form" onSubmit={handleSubmit} className="space-y-4">
              
              {!showTransferMode ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">Admin Resolution</h3>
                    {user.adminType === ticket.current_admin_type && (
                      <button 
                        type="button" 
                        onClick={() => setShowTransferMode(true)}
                        className="text-xs font-medium text-accent hover:text-accent/80 flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        Transfer Ticket
                      </button>
                    )}
                  </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                  <option value="closed" disabled>Closed</option>
                </select>
              </div>

              {ticket.type === 'request' && (status === 'resolved' || status === 'in_progress') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary flex items-center gap-2">
                    Fulfill Request (Select Available Asset)
                    {loadingAssets && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
                  </label>
                  <select
                    value={resolvedAssetId}
                    onChange={(e) => setResolvedAssetId(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">-- No asset selected --</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.serial_number})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Resolution Notes (Optional)</label>
                <textarea
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
                <button 
                  type="button" 
                  onClick={() => setShowTransferMode(false)}
                  className="text-xs font-medium text-secondary hover:text-primary"
                >
                  Cancel Transfer
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Transfer To</label>
                <select
                  required
                  value={targetAdminType}
                  onChange={(e) => setTargetAdminType(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-lg text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="" disabled>Select department...</option>
                  {ticket.current_admin_type !== 'it' && <option value="it">IT Admin</option>}
                  {ticket.current_admin_type !== 'hardware' && <option value="hardware">Hardware Admin</option>}
                  {ticket.current_admin_type !== 'hr' && <option value="hr">HR Admin</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Transfer Reason / Note</label>
                <textarea
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
                
                {ticket.status === 'resolved' && (
                  <div className="pt-4 border-t border-accent/10 flex items-center justify-end gap-3 mt-4">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setSubmitting(true);
                          await confirmTicket(ticket.id, 'reopen');
                          onClose();
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-base/50 rounded-lg transition-colors"
                    >
                      Reopen Ticket
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setSubmitting(true);
                          await confirmTicket(ticket.id, 'confirm');
                          onClose();
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-success hover:bg-success/90 rounded-lg shadow-sm transition-colors"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Confirm Resolution
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-base/50 shrink-0">
          {isAdmin && (
            <button
              form="resolve-form"
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (showTransferMode ? <ArrowRightLeft className="w-4 h-4" /> : <Check className="w-4 h-4" />)}
              {showTransferMode ? 'Confirm Transfer' : 'Save Changes'}
            </button>
          )}
          {!isAdmin && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg shadow-sm transition-colors"
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
