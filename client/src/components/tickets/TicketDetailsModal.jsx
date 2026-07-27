import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Package, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAssets } from '../../api/assetsApi';

const StatusBadge = ({ status }) => {
  const styles = {
    open: 'bg-error/10 text-error border-error/20',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    resolved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-raised text-secondary border-border'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const TicketDetailsModal = ({ isOpen, onClose, ticket, onUpdate }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [status, setStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedAssetId, setResolvedAssetId] = useState('');
  
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && ticket) {
      setStatus(ticket.status);
      setResolutionNotes(ticket.resolution_notes || '');
      setResolvedAssetId(ticket.resolved_asset_id || '');
      
      if (isAdmin && ticket.type === 'request' && ticket.status !== 'resolved') {
        loadAssets();
      }
    }
  }, [isOpen, ticket, isAdmin]);

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
            
            <div className="grid grid-cols-2 gap-4">
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
                <div className="bg-base rounded-lg p-3 border border-border">
                  <p className="text-sm text-primary whitespace-pre-wrap">{ticket.description}</p>
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

          {/* Resolution Area */}
          {isAdmin ? (
            <form id="resolve-form" onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-semibold text-primary">Admin Resolution</h3>
              
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
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
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
