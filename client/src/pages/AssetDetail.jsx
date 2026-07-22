import React from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsset from '../hooks/useAsset';
import SpecsProfile from '../components/asset-detail/SpecsProfile';
import HistoryTimeline from '../components/asset-detail/HistoryTimeline';
import AssigneeCard from '../components/asset-detail/AssigneeCard';
import LifecycleActions from '../components/asset-detail/LifecycleActions';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { ArrowLeft, RefreshCw, PackageX } from 'lucide-react';

export default function AssetDetail() {
  const { id } = useParams();
  const {
    asset,
    loading,
    error,
    refresh,
    updateNotes,
    assignToEmployee,
    returnToStock,
    retireAsset,
    deleteAsset,
  } = useAsset(id);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-4 w-32 bg-slate-800 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-72 bg-slate-800 rounded-xl border border-slate-700/60" />
            <div className="h-40 bg-slate-800 rounded-xl border border-slate-700/60" />
          </div>
          <div className="lg:col-span-1">
            <div className="h-96 bg-slate-800 rounded-xl border border-slate-700/60" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          icon={PackageX}
          title="Asset Record Not Found"
          description={error || `We couldn't find any hardware device matching ID #${id}. It may have been deleted.`}
          actionText="Return to Inventory"
          onAction={() => window.location.assign('/inventory')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/inventory"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Hardware Inventory</span>
        </Link>

        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer shadow-sm"
          title="Refresh asset state"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Grid Layout: Specs/Lifecycle on Left (2 cols), Timeline on Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Technical & Financial Specs Profile */}
          <SpecsProfile asset={asset} onUpdateNotes={updateNotes} />

          {/* 2. Assignee Profile Card (Only shown when in-use) */}
          <AssigneeCard asset={asset} />

          {/* 3. Lifecycle & Operational Controls */}
          <LifecycleActions
            asset={asset}
            onAssign={assignToEmployee}
            onReturn={returnToStock}
            onRetire={retireAsset}
            onDelete={deleteAsset}
          />
        </div>

        {/* 4. Chronological Audit Timeline */}
        <div className="lg:col-span-1 lg:sticky lg:top-24">
          <HistoryTimeline history={asset.history || []} loading={loading} />
        </div>
      </div>
    </div>
  );
}
