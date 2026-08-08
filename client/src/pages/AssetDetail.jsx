import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsset from '../hooks/useAsset';
import { useAuth } from '../context/AuthContext';
import SpecsProfile from '../components/asset-detail/SpecsProfile';
import HistoryTimeline from '../components/asset-detail/HistoryTimeline';
import AssigneeCard from '../components/asset-detail/AssigneeCard';
import LifecycleActions from '../components/asset-detail/LifecycleActions';
import LinkedAccessoriesCard from '../components/asset-detail/LinkedAccessoriesCard';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { ArrowLeft, RefreshCw, PackageX } from 'lucide-react';
import { getChildAssets } from '../api/assetsApi';

export default function AssetDetail() {
  const { id } = useParams();
  const {
    asset,
    loading,
    error,
    refresh,
    updateAssetData,
    assignToEmployee,
    returnToStock,
    retireAsset,
    deleteAsset,
  } = useAsset(id);
  
  const { hasPermission } = useAuth();
  const canUpdateAsset = hasPermission('assets:update');
  const canAssignAsset = hasPermission('assets:assign');
  const canDeleteAsset = hasPermission('assets:delete');
  const isReadOnly = !canUpdateAsset;

  const [childAssets, setChildAssets] = useState([]);

  useEffect(() => {
    if (asset?.id) {
      getChildAssets(asset.id)
        .then(res => setChildAssets(res.data?.data || []))
        .catch(() => {});
    }
  }, [asset?.id]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-4 w-32 bg-surface rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-72 bg-surface rounded-xl border border-border/60" />
            <div className="h-40 bg-surface rounded-xl border border-border/60" />
          </div>
          <div className="lg:col-span-1">
            <div className="h-96 bg-surface rounded-xl border border-border/60" />
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
        {!isReadOnly ? (
          <Link
            to="/inventory"
            className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Hardware Inventory</span>
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        )}

        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors cursor-pointer shadow-sm"
          title="Refresh asset state"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Grid Layout: Specs/Lifecycle on Left (2 cols), Timeline on Right (1 col) */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] lg:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 lg:col-span-2 space-y-6">
          {/* 1. Technical & Financial Specs Profile */}
          <SpecsProfile asset={asset} onUpdateAssetData={updateAssetData} readOnly={isReadOnly} />

          {/* 2. Assignee Profile Card (Only shown when in-use) */}
          <AssigneeCard asset={asset} readOnly={isReadOnly} />

          {/* Linked Accessories / Parent Asset Card */}
          {asset?.parentId && (
            <LinkedAccessoriesCard parentAsset={{ id: asset.parentId, name: asset.parentAssetName }} />
          )}
          {childAssets.length > 0 && (
            <LinkedAccessoriesCard children={childAssets} />
          )}

          {/* 3. Lifecycle & Operational Controls */}
          {(canAssignAsset || canDeleteAsset) && (
            <LifecycleActions
              asset={asset}
              canAssign={canAssignAsset}
              canDelete={canDeleteAsset}
              onAssign={canAssignAsset ? assignToEmployee : undefined}
              onReturn={canAssignAsset ? returnToStock : undefined}
              onRetire={canDeleteAsset ? retireAsset : undefined}
              onDelete={canDeleteAsset ? deleteAsset : undefined}
            />
          )}
        </div>

        {/* 4. Chronological Audit Timeline */}
        <div className="md:col-span-1 lg:col-span-1 md:sticky md:top-24">
          <HistoryTimeline history={asset.history || []} loading={loading} />
        </div>
      </div>
    </div>
  );
}
