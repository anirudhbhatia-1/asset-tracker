import React from 'react';
import AssetCard from './AssetCard';
import EmptyState from '../ui/EmptyState';
import { SkeletonCard } from '../ui/Skeleton';
import { PackageSearch } from 'lucide-react';
import SelectCheckbox from './SelectCheckbox';
import { selectionState } from '../../utils/assetSelection';

export default function AssetGrid({ assets, loading, refreshing = false, onClearFilters, selectedIds = null, onToggleSelect, onSelectMany }) {
  const selectable = Boolean(selectedIds && onToggleSelect);
  // The skeleton is only for the first load; a reload keeps the cards.
  if (loading && (!assets || assets.length === 0)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={PackageSearch}
          title="No assets found"
          description="Try adjusting your search query or filters to find what you're looking for."
          actionText="Clear Filters"
          onAction={onClearFilters}
        />
      </div>
    );
  }

  const ids = assets.map((asset) => asset.id);
  const state = selectable ? selectionState(selectedIds, ids) : 'none';

  return (
    <div className="space-y-3">
      {selectable && onSelectMany && (
        <div className="flex items-center gap-1 text-sm text-secondary">
          <SelectCheckbox
            checked={state === 'all'}
            indeterminate={state === 'some'}
            onChange={(checked) => onSelectMany(ids, checked)}
            label={`Select all ${ids.length} assets shown`}
          />
          <span aria-hidden="true">Select all {ids.length} shown</span>
        </div>
      )}
      <div
        aria-busy={refreshing || undefined}
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`}
      >
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            selectable={selectable}
            selected={selectable && selectedIds.has(asset.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  );
}
