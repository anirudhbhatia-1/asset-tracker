import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getEmployeeAssets } from '../api/employeesApi';
import { useOnboarding } from '../hooks/useOnboarding';
import Badge from '../components/ui/Badge';
import StatusPill from '../components/ui/StatusPill';
import { Laptop, Users, Calendar, Plus, PackageX, Briefcase, Settings, Target } from 'lucide-react';
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
  
  const { requests, hrMetrics, loading: requestsLoading, fetchRequests, fetchHrMetrics, createRequest, updateStatus, fulfillItem, getRequestDetails } = useOnboarding();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState('All');

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
    fetchHrMetrics();
  }, [fetchRequests, fetchHrMetrics]);

  const recentRequests = requests
    .filter(req => req.requested_by === user?.id)
    .filter(req => {
      if (filter === 'Pending') return req.status === 'pending' || req.status === 'in_progress';
      if (filter === 'Completed') return req.status === 'arranged' || req.status === 'completed';
      return true;
    })
    .sort((a, b) => new Date(a.joining_date) - new Date(b.joining_date));

  const safeAssets = Array.isArray(assets) ? assets : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Welcome, {user?.name || 'HR Partner'}</h1>
        <p className="text-sm text-secondary mt-1">
          Manage onboarding hardware requests and view your assigned assets.
        </p>
      </div>

      {/* HR Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface rounded-xl p-5 border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center text-warning shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{hrMetrics?.pending_onboardings || 0}</div>
            <div className="text-xs font-semibold text-secondary uppercase tracking-wider mt-0.5">Pending Onboardings</div>
          </div>
        </div>
        <div className="bg-surface rounded-xl p-5 border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{hrMetrics?.arranged_this_month || 0}</div>
            <div className="text-xs font-semibold text-secondary uppercase tracking-wider mt-0.5">Arranged This Month</div>
          </div>
        </div>
        <div className="bg-surface rounded-xl p-5 border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-info-blue/10 flex items-center justify-center text-info-blue shrink-0">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{hrMetrics?.assets_allocated || 0}</div>
            <div className="text-xs font-semibold text-secondary uppercase tracking-wider mt-0.5">Assets Allocated</div>
          </div>
        </div>
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
          <div className="px-4 pt-3 flex gap-2">
            {['All', 'Pending', 'Completed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === f ? 'bg-primary text-base-100 border-primary' : 'bg-base text-secondary border-border hover:border-primary/30'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="p-4 flex-1 max-h-[500px] overflow-y-auto">
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
                    <div key={req.id} className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex flex-col gap-3">
                       <div className="flex justify-between items-start">
                         <div className="min-w-0">
                           <div className="text-sm font-bold text-primary truncate">{req.new_hire_name}</div>
                           <div className="text-xs text-secondary mt-0.5">Joining: {new Date(req.joining_date).toLocaleDateString()}</div>
                         </div>
                         <OnboardingStatusBadge status={req.status} />
                       </div>
                       {req.items_summary && (
                         <div className="text-xs text-secondary bg-surface p-2 rounded-lg border border-border/50 truncate">
                           <span className="font-semibold text-primary mr-1">Items:</span>
                           {req.items_summary}
                         </div>
                       )}
                       <div className="pt-2 border-t border-border/50 flex justify-end gap-2">
                         <button
                           onClick={() => setSelectedRequest(req)}
                           className="px-3 py-1.5 bg-info-blue/10 hover:bg-info-blue/20 text-info-blue text-xs font-medium rounded-lg transition-colors border border-info-blue/20"
                         >
                           View Items
                         </button>
                         {['pending', 'in_progress'].includes(req.status) && (
                           <button className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium rounded-lg transition-colors border border-accent/20">
                             Edit Request
                           </button>
                         )}
                       </div>
                    </div>
                  ))}
                 {requests.filter(req => req.requested_by === user?.id).length > 5 && (
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
          <div className="p-4 flex-1 max-h-[500px] overflow-y-auto">
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
