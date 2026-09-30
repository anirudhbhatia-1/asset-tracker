import React, { useState, useMemo } from 'react';
import AssetTableRow from './AssetTableRow';
import { SkeletonTable } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

export default function AssetTable({ assets = [], loading = false, onClearFilters }) {
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  const safeAssets = Array.isArray(assets) ? assets : [];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAssets = useMemo(() => {
    if (safeAssets.length === 0) return [];
    return [...safeAssets].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [safeAssets, sortField, sortDirection]);

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-secondary opacity-0 group-hover/th:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-accent" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-accent" />
    );
  };

  // Sortable column header: the button carries the keyboard interaction and
  // aria-sort announces the current order to screen readers.
  const renderSortableHeader = (field, label) => (
    <th
      key={field}
      scope="col"
      aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-6 py-3.5 hover:text-primary transition-colors"
    >
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="group/th flex items-center gap-1.5 uppercase tracking-wider font-semibold cursor-pointer rounded"
      >
        <span>{label}</span>
        {renderSortIcon(field)}
      </button>
    </th>
  );

  if (loading) {
    return <SkeletonTable rows={8} />;
  }

  if (safeAssets.length === 0) {
    return (
      <EmptyState
        title="No assets matching criteria"
        description="We couldn't find any hardware inventory items with the selected search terms or filters."
        actionText="Clear All Filters"
        onAction={onClearFilters}
      />
    );
  }

  return (
    <div className="w-full bg-surface rounded-xl border border-border/80 overflow-hidden shadow-sm relative">
      {/* Scroll affordance shadow on mobile */}
      <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none md:hidden z-10" />
      <div className="overflow-x-auto pb-1">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <caption className="sr-only">Hardware assets. Column headers with sort buttons reorder the list.</caption>
          <thead>
            <tr className="bg-surface/90 border-b border-border/80 text-xs font-semibold uppercase tracking-wider text-secondary select-none">
              <th scope="col" className="px-6 py-3.5 w-12 text-center">
                <abbr title="Category" className="no-underline">Cat</abbr>
              </th>

              {renderSortableHeader('name', 'Asset Name / Model')}
              {renderSortableHeader('serialNumber', 'Serial Number')}
              {renderSortableHeader('status', 'Status')}
              {renderSortableHeader('warrantyExpiryDate', 'Warranty')}
              {renderSortableHeader('location', 'Location')}
              {renderSortableHeader('assigneeName', 'Assigned To')}
              {renderSortableHeader('assignedDate', 'Assigned Date')}

              <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-surface/40">
            {sortedAssets.map((asset) => (
              <AssetTableRow key={asset.id} asset={asset} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3.5 bg-surface/90 border-t border-border/80 flex items-center justify-between text-xs text-secondary">
        <span>Showing {safeAssets.length} items</span>
        <span>Sorted by {sortField} ({sortDirection.toUpperCase()})</span>
      </div>
    </div>
  );
}
