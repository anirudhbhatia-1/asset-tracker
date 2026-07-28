import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getEmployeeAssets } from '../api/employeesApi';
import { useOnboarding } from '../hooks/useOnboarding';
import Badge from '../components/ui/Badge';
import StatusPill from '../components/ui/StatusPill';
import { Laptop, Users, Calendar, Plus, PackageX } from 'lucide-react';
import { Link } from 'react-router-dom';
import CreateOnboardingModal from '../components/forms/CreateOnboardingModal';
import OnboardingDetailsModal from '../components/hr/OnboardingDetailsModal';

const OnboardingStatusBadge = ({ status }) => {
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

export default function HrDashboard() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  
  const { requests, loading: requestsLoading, fetchRequests, createRequest, updateStatus, fulfillItem, getRequestDetails } = useOnboarding();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    if (user?.id) {
      getEmployeeAssets(user.id)
        .then(res => setAssets(res.data?.data || []))
        .catch(err => console.error("Failed to fetch assets", err))
        .finally(() => setAssetsLoading(false));
    } else {
      setAssetsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const recentRequests = requests
    .filter(req => req.requested_by_id === user?.id)
    .sort((a, b) => new Date(a.joining_date) - new Date(b.joining_date))
    .slice(0, 5); // show most recent 5 on dashboard

  const safeAssets = Array.isArray(assets) ? assets : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Welcome, {user?.name || 'HR Partner'}</h1>
        <p className="text-sm text-secondary mt-1">
          Manage onboarding hardware requests and view your assigned assets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Onboarding Requests */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-base/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              My Onboarding Requests
            </h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Hire
            </button>
          </div>
          <div className="p-4 flex-1">
             {requestsLoading ? (
               <div className="animate-pulse space-y-3">
                 {[1,2,3].map(i => <div key={i} className="h-14 bg-base rounded-xl border border-border" />)}
               </div>
             ) : recentRequests.length === 0 ? (
               <div className="py-10 bg-base/40 rounded-xl border border-border/40 text-center space-y-2">
                 <p className="text-sm font-medium text-secondary">No Active Onboarding Requests</p>
               </div>
             ) : (
               <div className="space-y-3">
                 {recentRequests.map(req => (
                    <div key={req.id} onClick={() => setSelectedRequest(req)} className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex items-center justify-between cursor-pointer hover:bg-raised/50">
                       <div className="min-w-0">
                         <div className="text-sm font-bold text-primary truncate">{req.new_hire_name}</div>
                         <div className="text-xs text-secondary mt-0.5">Joining: {new Date(req.joining_date).toLocaleDateString()}</div>
                       </div>
                       <div>
                         <OnboardingStatusBadge status={req.status} />
                       </div>
                    </div>
                 ))}
                 {requests.filter(req => req.requested_by_id === user?.id).length > 5 && (
                   <Link to="/onboarding" className="block text-center text-xs font-medium text-accent hover:underline mt-4">
                     View All Requests
                   </Link>
                 )}
               </div>
             )}
          </div>
        </div>

        {/* My Assets */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-base/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-accent" />
              My Assigned Assets
            </h2>
          </div>
          <div className="p-4 flex-1">
            {assetsLoading ? (
               <div className="animate-pulse space-y-3">
                 {[1,2].map(i => <div key={i} className="h-16 bg-base rounded-xl border border-border" />)}
               </div>
            ) : safeAssets.length === 0 ? (
               <div className="py-10 bg-base/40 rounded-xl border border-border/40 text-center space-y-2">
                 <PackageX className="w-8 h-8 text-secondary mx-auto" />
                 <p className="text-sm font-medium text-secondary">No Assets Assigned</p>
               </div>
            ) : (
               <div className="space-y-3">
                 {safeAssets.map(asset => (
                   <div key={asset.id} className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex items-center justify-between gap-3">
                     <div className="flex items-center gap-3 min-w-0">
                       <Badge badgeChar={asset.categoryBadgeChar || asset.categoryName?.[0] || '?'} color={asset.categoryColor} title={asset.categoryName} />
                       <div className="min-w-0">
                         <div className="text-sm font-bold text-primary truncate">{asset.name}</div>
                         <div className="flex items-center gap-2.5 text-xs text-secondary mt-0.5">
                           <span className="font-mono text-accent/90">{asset.serialNumber}</span>
                           {asset.model && <span className="truncate">· {asset.model}</span>}
                         </div>
                       </div>
                     </div>
                     <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                       <StatusPill status={asset.status} />
                       {asset.assignedDate && (
                         <span className="text-[11px] font-mono text-secondary flex items-center gap-1">
                           <Calendar className="w-3 h-3" /> {asset.assignedDate}
                         </span>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>
      </div>
      <CreateOnboardingModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={createRequest} />
      <OnboardingDetailsModal isOpen={!!selectedRequest} request={selectedRequest} onClose={() => setSelectedRequest(null)} getRequestDetails={getRequestDetails} onUpdateStatus={updateStatus} onFulfillItem={fulfillItem} />
    </div>
  );
}
