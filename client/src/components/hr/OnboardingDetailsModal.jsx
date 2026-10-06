import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { X, Loader2, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAvailableAssets } from '../../api/assetsApi';
import useFocusTrap from '../../hooks/useFocusTrap';
import { getFulfilmentCandidates, getOnboardingStatusOptions, ONBOARDING_STATUS_LABELS } from '../../utils/onboardingStatus';
import { formatDate } from '../../utils/formatters';

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-raised text-secondary border-border',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    arranged: 'bg-success/10 text-success border-success/20',
    completed: 'bg-success text-on-accent border-success',
    cancelled: 'bg-error/10 text-error border-error/20'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${styles[status] || styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

const OnboardingDetailsModal = ({ isOpen, onClose, request, getRequestDetails, onUpdateStatus, onFulfillItem }) => {
  const { hasPermission } = useAuth();
  const canUpdateStatus = hasPermission('onboarding:update');
  const canFulfillItems = hasPermission('onboarding:fulfill');
  
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [status, setStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [fulfillingItemId, setFulfillingItemId] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [submittingFulfil, setSubmittingFulfil] = useState(false);
  // Server refusals (e.g. 409 asset reserved / not in stock, 400 bad move)
  const [actionError, setActionError] = useState(null);

  const requestId = request?.id;

  const loadFullDetails = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const data = await getRequestDetails(requestId);
      setFullData(data);
      setStatus(data?.status || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [requestId, getRequestDetails]);

  // Only in-stock company assets can fulfil an item.
  const loadAvailableAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const res = await getAvailableAssets();
      setAssets(res.data?.data || []);
    } catch (err) {
      setActionError(errorMessage(err, 'Could not load available assets'));
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && requestId) {
      setActionError(null);
      loadFullDetails();
      if (canFulfillItems) {
        loadAvailableAssets();
      }
    } else {
      setFullData(null);
      setFulfillingItemId(null);
      setSelectedAssetId('');
      setActionError(null);
    }
    // Keyed on the id, so a list refresh (new row objects) doesn't reload.
  }, [isOpen, requestId, canFulfillItems, loadFullDetails, loadAvailableAssets]);

  const handleUpdateStatus = async () => {
    setUpdatingStatus(true);
    setActionError(null);
    try {
      await onUpdateStatus(request.id, status);
      await loadFullDetails();
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update status'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFulfillItem = async (itemId) => {
    if (!selectedAssetId) return;
    setSubmittingFulfil(true);
    setActionError(null);
    try {
      await onFulfillItem(request.id, itemId, parseInt(selectedAssetId, 10));
      setFulfillingItemId(null);
      setSelectedAssetId('');
      await loadFullDetails();
      await loadAvailableAssets(); // refresh available assets
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to fulfil item'));
    } finally {
      setSubmittingFulfil(false);
    }
  };

  // Assets already linked to another item of this request are taken.
  const linkedAssetIds = new Set((fullData?.items || []).map(i => i.fulfilled_asset_id).filter(Boolean));
  const currentStatus = fullData?.status || request?.status;
  const statusOptions = getOnboardingStatusOptions(currentStatus);
  const itemsLocked = ['completed', 'cancelled'].includes(currentStatus);

  const dialogRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen && !!request, onClose);

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-base/75 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90dvh] animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <div className="flex items-center gap-3">
            <h2 id={titleId} className="text-lg font-semibold text-primary">Onboarding #{request.id}</h2>
            <StatusBadge status={fullData?.status || request.status} />
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2.5 sm:p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
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
              
              {/* Top Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-base p-4 rounded-lg border border-border">
                <div>
                  <div className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">New Hire</div>
                  <div className="text-sm font-semibold text-primary">{fullData.new_hire_name}</div>
                  {fullData.new_hire_email && <div className="text-xs text-secondary mt-0.5">{fullData.new_hire_email}</div>}
                </div>
                <div>
                  <div className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Role / Dept</div>
                  <div className="text-sm text-primary">{fullData.department || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Location</div>
                  <div className="text-sm text-primary">{fullData.address ? `${fullData.location} (${fullData.address})` : (fullData.location || '—')}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Joining Date</div>
                  <div className="text-sm text-primary font-medium">{formatDate(fullData.joining_date)}</div>
                </div>
              </div>

              {fullData.notes && (
                <div>
                  <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">Notes</h3>
                  <div className="text-sm text-primary bg-base p-3 rounded-lg border border-border">
                    {fullData.notes}
                  </div>
                </div>
              )}

              <hr className="border-border" />

              {/* Hardware Items */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-4">Hardware Requests</h3>
                
                {!fullData.items || fullData.items.length === 0 ? (
                  <p className="text-sm text-secondary italic">No hardware items requested.</p>
                ) : (
                  <div className="space-y-3">
                    {fullData.items.map(item => (
                      <div key={item.id} className="flex flex-col sm:flex-row gap-4 p-4 bg-base rounded-lg border border-border items-start sm:items-center justify-between">
                        <div>
                          <div className="font-medium text-primary flex items-center gap-2">
                            <Package className="w-4 h-4 text-secondary" />
                            {item.quantity}x {item.category_name || `Category #${item.category_id}`}
                          </div>
                          {item.notes && <div className="text-xs text-secondary mt-1 ml-6">{item.notes}</div>}
                        </div>
                        
                        {/* Fulfillment Section */}
                        <div className="w-full sm:w-auto">
                          {item.fulfilled_asset_id ? (
                            <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-3 py-1.5 rounded-md border border-success/20 w-max">
                              <CheckCircle2 className="w-4 h-4" />
                              Arranged: {item.fulfilled_asset_name}
                            </div>
                          ) : canFulfillItems && !itemsLocked ? (
                            fulfillingItemId === item.id ? (
                              <div className="flex items-center gap-2 w-full sm:w-max">
                                <select
                                  value={selectedAssetId}
                                  onChange={(e) => { setSelectedAssetId(e.target.value); setActionError(null); }}
                                  aria-label={`Asset for ${item.category_name || 'item'}`}
                                  className="w-full sm:w-48 px-2 py-1.5 bg-surface border border-border rounded-md text-xs text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                                >
                                  <option value="">{loadingAssets ? 'Loading assets...' : 'Select Asset...'}</option>
                                  {getFulfilmentCandidates(assets, item)
                                    .filter(a => !linkedAssetIds.has(a.id))
                                    .map(a => (
                                      <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>
                                    ))}
                                </select>
                                <button
                                  onClick={() => handleFulfillItem(item.id)}
                                  disabled={!selectedAssetId || submittingFulfil}
                                  className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-on-accent text-xs font-medium rounded-md disabled:opacity-50 transition-colors"
                                >
                                  Fulfill
                                </button>
                                <button
                                  onClick={() => { setFulfillingItemId(null); setSelectedAssetId(''); }}
                                  className="px-2 py-1.5 text-secondary hover:text-primary text-xs font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setFulfillingItemId(item.id); setSelectedAssetId(''); setActionError(null); }}
                                className="px-3 py-1.5 border border-accent text-accent hover:bg-accent/5 text-xs font-medium rounded-md transition-colors"
                              >
                                Link Asset
                              </button>
                            )
                          ) : (
                            <div className="text-xs text-warning bg-warning/10 px-2 py-1 rounded-md border border-warning/20">Pending Fulfillment</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : null}

          {actionError && (
            <div role="alert" className="mt-4 flex items-start gap-2 bg-error/10 border border-error/20 text-error rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
        </div>

        {/* Footer (Admin Status Update) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border bg-base/50 shrink-0">
          
          {canUpdateStatus ? (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-sm font-medium text-primary whitespace-nowrap">Update Status:</span>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setActionError(null); }}
                disabled={statusOptions.length <= 1}
                className="w-full sm:w-auto px-3 py-1.5 bg-surface border border-border rounded-md text-sm text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              >
                {/* Only the moves the server allows from the current status */}
                {statusOptions.map(value => (
                  <option key={value} value={value}>{ONBOARDING_STATUS_LABELS[value] || value}</option>
                ))}
              </select>
              <button
                onClick={handleUpdateStatus}
                disabled={updatingStatus || !fullData || status === fullData.status}
                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-surface text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
              >
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          ) : <div></div>}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-on-accent bg-secondary hover:bg-secondary/90 rounded-lg shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingDetailsModal;
