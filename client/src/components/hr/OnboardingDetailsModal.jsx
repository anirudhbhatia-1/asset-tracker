import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, Package, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAssets } from '../../api/assetsApi';

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-raised text-secondary border-border',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    arranged: 'bg-success/10 text-success border-success/20',
    completed: 'bg-success text-white border-success',
    cancelled: 'bg-error/10 text-error border-error/20'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${styles[status] || styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const OnboardingDetailsModal = ({ isOpen, onClose, request, getRequestDetails, onUpdateStatus, onFulfillItem }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [status, setStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [fulfillingItemId, setFulfillingItemId] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  useEffect(() => {
    if (isOpen && request) {
      loadFullDetails();
      setStatus(request.status);
      
      if (isAdmin) {
        loadAvailableAssets();
      }
    } else {
      setFullData(null);
      setFulfillingItemId(null);
    }
  }, [isOpen, request, isAdmin]);

  const loadFullDetails = async () => {
    setLoading(true);
    try {
      const data = await getRequestDetails(request.id);
      setFullData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await getAssets({ status: 'available' });
      setAssets(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleUpdateStatus = async () => {
    setUpdatingStatus(true);
    try {
      await onUpdateStatus(request.id, status);
      await loadFullDetails();
    } catch (err) {
      // hook handles error toast
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFulfillItem = async (itemId) => {
    if (!selectedAssetId) return;
    try {
      await onFulfillItem(request.id, itemId, parseInt(selectedAssetId, 10));
      setFulfillingItemId(null);
      setSelectedAssetId('');
      await loadFullDetails();
      await loadAvailableAssets(); // refresh available assets
    } catch (err) {
      // hook handles error toast
    }
  };

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-primary">Onboarding #{request.id}</h2>
            <StatusBadge status={fullData?.status || request.status} />
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-base p-4 rounded-lg border border-border">
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
                  <div className="text-sm text-primary">{fullData.location || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">Joining Date</div>
                  <div className="text-sm text-primary font-medium">{new Date(fullData.joining_date).toLocaleDateString()}</div>
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
                          ) : isAdmin ? (
                            fulfillingItemId === item.id ? (
                              <div className="flex items-center gap-2 w-full sm:w-max">
                                <select
                                  value={selectedAssetId}
                                  onChange={(e) => setSelectedAssetId(e.target.value)}
                                  className="w-full sm:w-48 px-2 py-1.5 bg-surface border border-border rounded-md text-xs text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                                >
                                  <option value="">Select Asset...</option>
                                  {assets.filter(a => a.category_id === item.category_id).map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.serial_number})</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleFulfillItem(item.id)}
                                  disabled={!selectedAssetId}
                                  className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium rounded-md disabled:opacity-50 transition-colors"
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
                                onClick={() => setFulfillingItemId(item.id)}
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
        </div>

        {/* Footer (Admin Status Update) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border bg-base/50 shrink-0">
          
          {isAdmin ? (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-sm font-medium text-primary whitespace-nowrap">Update Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-surface border border-border rounded-md text-sm text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="arranged">Arranged</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={handleUpdateStatus}
                disabled={updatingStatus || status === fullData?.status}
                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-surface text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
              >
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          ) : <div></div>}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-secondary hover:bg-secondary/90 rounded-lg shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingDetailsModal;
