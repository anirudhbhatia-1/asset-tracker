import React, { useState, useEffect, useId, useCallback } from 'react';
import { Loader2, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAvailableAssets } from '../../api/assetsApi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Pill from '../ui/Pill';
import { Select } from '../ui/Field';
import OnboardingStatusBadge from './OnboardingStatusBadge';
import { getFulfilmentCandidates, getOnboardingStatusOptions, ONBOARDING_STATUS_LABELS } from '../../utils/onboardingStatus';
import { formatDate } from '../../utils/formatters';

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

  const statusSelectId = useId();

  if (!request) return null;

  // Footer: admin status update on the left, Close on the right.
  const footer = (
    <>
      {canUpdateStatus && (
        <div className="flex items-center gap-3 w-full sm:w-auto sm:mr-auto">
          <label htmlFor={statusSelectId} className="text-sm font-medium text-primary whitespace-nowrap">Update Status:</label>
          <Select
            id={statusSelectId}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setActionError(null); }}
            disabled={statusOptions.length <= 1}
            className="sm:w-auto"
          >
            {/* Only the moves the server allows from the current status */}
            {statusOptions.map(value => (
              <option key={value} value={value}>{ONBOARDING_STATUS_LABELS[value] || value}</option>
            ))}
          </Select>
          <Button
            onClick={handleUpdateStatus}
            disabled={!fullData || status === fullData.status}
            loading={updatingStatus}
          >
            Save
          </Button>
        </div>
      )}
      <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
        Close
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Onboarding #${request.id}`}
      headerExtra={<OnboardingStatusBadge status={fullData?.status || request.status} />}
      maxWidth="max-w-3xl"
      footer={footer}
    >
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
                        <Pill tone="success" size="md" icon={CheckCircle2}>
                          Arranged: {item.fulfilled_asset_name}
                        </Pill>
                      ) : canFulfillItems && !itemsLocked ? (
                        fulfillingItemId === item.id ? (
                          <div className="flex items-center gap-2 w-full sm:w-max">
                            <Select
                              value={selectedAssetId}
                              onChange={(e) => { setSelectedAssetId(e.target.value); setActionError(null); }}
                              aria-label={`Asset for ${item.category_name || 'item'}`}
                              className="sm:w-48"
                            >
                              <option value="">{loadingAssets ? 'Loading assets…' : 'Select Asset…'}</option>
                              {getFulfilmentCandidates(assets, item)
                                .filter(a => !linkedAssetIds.has(a.id))
                                .map(a => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>
                                ))}
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => handleFulfillItem(item.id)}
                              disabled={!selectedAssetId || submittingFulfil}
                            >
                              Fulfill
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setFulfillingItemId(null); setSelectedAssetId(''); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setFulfillingItemId(item.id); setSelectedAssetId(''); setActionError(null); }}
                          >
                            Link Asset
                          </Button>
                        )
                      ) : (
                        <Pill tone="warning">Pending Fulfillment</Pill>
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
    </Modal>
  );
};

export default OnboardingDetailsModal;
