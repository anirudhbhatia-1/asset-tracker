import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, AlertCircle, Building2, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../hooks/useOnboarding';
import CreateOnboardingModal from '../components/forms/CreateOnboardingModal';
import OnboardingDetailsModal from '../components/hr/OnboardingDetailsModal';

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

const Onboarding = () => {
  const { user } = useAuth();
  const { requests, loading, error, fetchRequests, createRequest, updateStatus, fulfillItem, getRequestDetails } = useOnboarding();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState('active'); // pending, in_progress, arranged

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['pending', 'in_progress', 'arranged'].includes(r.status);
    if (filter === 'completed') return ['completed', 'cancelled'].includes(r.status);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Users className="w-6 h-6 text-accent" />
            HR Onboarding
          </h1>
          <p className="text-secondary text-sm mt-1">
            {user?.role === 'admin' ? 'Manage IT setup for incoming employees.' : 'Submit and track hardware requests for new hires.'}
          </p>
        </div>
        
        {user?.role === 'hr' && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Hire Request
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 bg-base p-1.5 rounded-lg border border-border w-max">
        {['active', 'completed', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-surface text-primary shadow-sm border border-border' : 'text-secondary hover:text-primary hover:bg-raised/50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Requests Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-base border-b border-border text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">New Hire</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Role / Dept</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Joining Date</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                {user?.role === 'admin' && <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Requested By</th>}
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                // Skeleton loading rows
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-16"></div></td>
                    {user?.role === 'admin' && <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-32"></div></td>}
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-secondary">
                    No onboarding requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr 
                    key={req.id} 
                    onClick={() => setSelectedRequest(req)}
                    className="hover:bg-raised/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-primary group-hover:text-accent">{req.new_hire_name}</div>
                      {req.new_hire_email && <div className="text-xs text-secondary mt-0.5">{req.new_hire_email}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Building2 className="w-3.5 h-3.5 text-secondary" />
                        {req.department || '—'}
                      </div>
                      {req.location && (
                        <div className="flex items-center gap-2 text-xs text-secondary mt-1">
                          <MapPin className="w-3 h-3" />
                          {req.location}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-primary">
                      {new Date(req.joining_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 text-secondary">{req.requested_by_email}</td>
                    )}
                    <td className="px-6 py-4 text-secondary">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateOnboardingModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSubmit={createRequest} 
      />

      <OnboardingDetailsModal 
        isOpen={!!selectedRequest} 
        request={selectedRequest} 
        onClose={() => setSelectedRequest(null)} 
        getRequestDetails={getRequestDetails}
        onUpdateStatus={updateStatus}
        onFulfillItem={fulfillItem}
      />
    </div>
  );
};

export default Onboarding;
