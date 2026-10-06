import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserMinus, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOffboarding } from '../hooks/useOffboarding';
import { offboardingApi } from '../api/offboardingApi';
import StartOffboardingModal from '../components/offboarding/StartOffboardingModal';
import OffboardingDetailsModal from '../components/offboarding/OffboardingDetailsModal';
import OffboardingStatusBadge from '../components/offboarding/OffboardingStatusBadge';
import { onActivateKey } from '../utils/a11y';
import PageHeader from '../components/ui/PageHeader';
import { formatDate } from '../utils/formatters';
import { describeChecklistProgress } from '../utils/offboardingProgress';
import SegmentedControl from '../components/ui/SegmentedControl';
import EmptyState from '../components/ui/EmptyState';
import {
  OFFBOARDING_FILTERS,
  matchesOffboardingFilter,
  getLastDayUrgency,
  getChecklistProgress,
  getReasonLabel,
} from '../utils/offboarding';

const urgencyStyles = {
  overdue: { date: 'text-error', label: 'text-error' },
  soon: { date: 'text-warning', label: 'text-warning' },
};

const LastDayCell = ({ request }) => {
  const urgency = getLastDayUrgency(request.lastWorkingDate, request.status);
  const style = urgency ? urgencyStyles[urgency.tone] : null;
  return (
    <div>
      <div className={`font-medium ${style?.date || 'text-primary'}`}>{formatDate(request.lastWorkingDate)}</div>
      {style && <div className={`text-xs font-medium mt-0.5 ${style.label}`}>{urgency.label}</div>}
    </div>
  );
};

const AssetProgressCell = ({ request }) => {
  const progress = getChecklistProgress(request);
  if (progress.total === 0) return <span className="text-secondary">No assets</span>;
  return (
    <div className="min-w-[8rem]">
      <div className="text-primary text-xs mb-1">{describeChecklistProgress(progress)}</div>
      <div
        className="w-full h-1.5 rounded-full bg-raised overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.collected}
        aria-label={`Assets: ${describeChecklistProgress(progress)}`}
      >
        <div className={`h-full rounded-full ${progress.pending === 0 ? 'bg-success' : 'bg-accent'}`} style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
};

const Offboarding = () => {
  const { hasPermission } = useAuth();
  const {
    requests, loading, error, fetchRequests, createRequest, updateRequest,
    resolveItem, completeRequest, cancelRequest, getRequestDetails,
  } = useOffboarding({ initialLoad: true });

  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState('open');
  const [requestsLoaded, setRequestsLoaded] = useState(false);

  // Deep link from notifications: /offboarding?request=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkId = searchParams.get('request');
  const handledDeepLinkRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchRequests().then(() => {
      if (!cancelled) setRequestsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [fetchRequests]);

  const clearDeepLink = useCallback(() => {
    setSearchParams(prev => {
      if (!prev.has('request')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('request');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (!deepLinkId) {
      handledDeepLinkRef.current = null;
      return;
    }
    if (!requestsLoaded || handledDeepLinkRef.current === deepLinkId) return;
    handledDeepLinkRef.current = deepLinkId;

    const match = requests.find(r => String(r.id) === deepLinkId);
    if (match) {
      setSelectedRequest(match);
      return;
    }
    // Not in the loaded list: fetch it directly. Ignore the answer if the
    // user has moved on to a different link in the meantime.
    offboardingApi.getById(deepLinkId)
      .then(req => {
        if (req && handledDeepLinkRef.current === deepLinkId) setSelectedRequest(req);
      })
      .catch(() => {
        if (handledDeepLinkRef.current !== deepLinkId) return;
        toast.error(`Offboarding request #${deepLinkId} was not found.`);
        clearDeepLink();
      });
  }, [deepLinkId, requests, requestsLoaded, clearDeepLink]);

  const closeRequestDetails = useCallback(() => {
    setSelectedRequest(null);
    clearDeepLink();
  }, [clearDeepLink]);

  // Opens a request by id (a new one, or the existing open exit).
  const openRequestById = useCallback((id) => {
    if (!id) return;
    setSelectedRequest(requests.find(r => String(r.id) === String(id)) || { id });
  }, [requests]);

  const filteredRequests = requests.filter(r => matchesOffboardingFilter(r, filter));
  const canCollect = hasPermission('offboarding:collect');

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header Area */}
      <PageHeader
        icon={UserMinus}
        title="Offboarding"
        subtitle={canCollect && !hasPermission('offboarding:create')
          ? 'Collect company and client assets from leaving employees.'
          : canCollect
            ? 'Track employee exits and collect their assets.'
            : 'Start and track employee exits; IT collects their assets.'}
        actions={hasPermission('offboarding:create') && (
          <button
            type="button"
            onClick={() => setIsStartModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-on-accent rounded-lg font-medium shadow-sm transition-all"
          >
            <UserMinus className="w-4 h-4" />
            Start Offboarding
          </button>
        )}
      />

      {/* Filters */}
      <SegmentedControl label="Filter by status" value={filter} onChange={setFilter} options={OFFBOARDING_FILTERS} />

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Requests Table (empty state sits outside the table so it isn't
          clipped by the sideways-scrolling area on phones) */}
      {!(loading && requests.length === 0) && filteredRequests.length === 0 ? (
        <EmptyState
          icon={UserMinus}
          title={filter === 'open' ? 'No one is leaving right now' : 'No offboarding requests found'}
          description={filter === 'open' ? 'Open exits will appear here until their assets are collected.' : 'Nothing matches this filter.'}
          actionText={hasPermission('offboarding:create') ? 'Start Offboarding' : undefined}
          onAction={hasPermission('offboarding:create') ? () => setIsStartModalOpen(true) : undefined}
        />
      ) : (
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Scroll affordance */}
        <div className="relative">
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10 md:hidden" />
          <div className="overflow-x-auto pb-1">
            <table aria-label="Offboarding requests" className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-base border-b border-border text-secondary">
                <tr>
                  <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Employee</th>
                  <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Last Working Day</th>
                  <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Reason</th>
                  <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Assets</th>
                  <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && requests.length === 0 ? (
                  // Skeleton loading rows
                  [1, 2, 3].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-20"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-28"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-16"></div></td>
                    </tr>
                  ))
                ) : (
                  filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      tabIndex={0}
                      onKeyDown={onActivateKey(() => setSelectedRequest(req))}
                      className="hover:bg-raised/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-primary group-hover:text-accent">{req.employeeName}</div>
                        {req.employeeEmail && <div className="text-xs text-secondary mt-0.5">{req.employeeEmail}</div>}
                        {req.employeeDepartment && (
                          <div className="flex items-center gap-1.5 text-xs text-secondary mt-0.5">
                            <Building2 className="w-3 h-3" aria-hidden="true" />
                            {req.employeeDepartment}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4"><LastDayCell request={req} /></td>
                      <td className="px-6 py-4 text-primary">{getReasonLabel(req.reason) || <span className="text-secondary">—</span>}</td>
                      <td className="px-6 py-4"><AssetProgressCell request={req} /></td>
                      <td className="px-6 py-4"><OffboardingStatusBadge status={req.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      <StartOffboardingModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onSubmit={createRequest}
        onCreated={(created) => setSelectedRequest(created)}
        onOpenExisting={openRequestById}
      />

      <OffboardingDetailsModal
        isOpen={!!selectedRequest}
        request={selectedRequest}
        onClose={closeRequestDetails}
        getRequestDetails={getRequestDetails}
        onUpdate={updateRequest}
        onResolveItem={resolveItem}
        onComplete={completeRequest}
        onCancel={cancelRequest}
      />
    </div>
  );
};

export default Offboarding;
