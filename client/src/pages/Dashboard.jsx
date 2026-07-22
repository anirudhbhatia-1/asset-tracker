import React from 'react';
import useMetrics from '../hooks/useMetrics';
import useHistory from '../hooks/useHistory';
import MetricCard from '../components/dashboard/MetricCard';
import InventoryBreakdown from '../components/dashboard/InventoryBreakdown';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import GoogleBanner from '../components/dashboard/GoogleBanner';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Package, Clock, CheckCircle2, Archive, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { metrics, breakdown, loading: metricsLoading, error: metricsError, refresh: refreshMetrics } = useMetrics();
  const { history, loading: historyLoading, error: historyError, refresh: refreshHistory } = useHistory(20);

  const handleRefresh = () => {
    refreshMetrics();
    refreshHistory();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">System Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Live hardware asset counts, categorical distribution, and immutable audit stream.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors self-start sm:self-center shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading || historyLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error banner if fetching failed */}
      {(metricsError || historyError) && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-300 flex items-center justify-between">
          <span>{metricsError || historyError}</span>
          <button onClick={handleRefresh} className="underline text-xs hover:text-white cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* 1. Metric Grid — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Hardware Assets"
              count={metrics.total}
              icon={Package}
              delta="100% Tracked"
              deltaPositive={true}
              colorClass="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
            />
            <MetricCard
              title="In Use / Assigned"
              count={metrics.inUse}
              icon={Clock}
              delta={`${metrics.total ? Math.round((metrics.inUse / metrics.total) * 100) : 0}% Active`}
              deltaPositive={true}
              colorClass="text-blue-400 bg-blue-500/10 border-blue-500/20"
            />
            <MetricCard
              title="Available in Stock"
              count={metrics.available}
              icon={CheckCircle2}
              delta={`${metrics.total ? Math.round((metrics.available / metrics.total) * 100) : 0}% Ready`}
              deltaPositive={true}
              colorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            />
            <MetricCard
              title="Retired / Decommissioned"
              count={metrics.retired}
              icon={Archive}
              delta={`${metrics.total ? Math.round((metrics.retired / metrics.total) * 100) : 0}% EOL`}
              deltaPositive={false}
              colorClass="text-slate-400 bg-slate-500/10 border-slate-500/20"
            />
          </>
        )}
      </div>

      {/* 2. Google Workspace Sync Banner */}
      <GoogleBanner />

      {/* 3. Two-Column Layout: Inventory Breakdown (Left) & Activity Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <InventoryBreakdown breakdown={breakdown} loading={metricsLoading} />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed history={history} loading={historyLoading} />
        </div>
      </div>
    </div>
  );
}
