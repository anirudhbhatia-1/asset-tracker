import React from 'react';
import AssetCard from './AssetCard';
import EmptyState from '../ui/EmptyState';
import { SkeletonCard } from '../ui/Skeleton';
import { PackageSearch } from 'lucide-react';

export default function AssetGrid({ assets, loading, onClearFilters }) {
  if (loading) {
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}
