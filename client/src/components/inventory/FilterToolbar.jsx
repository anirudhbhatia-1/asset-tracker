import React from 'react';
import Badge from '../ui/Badge';
import { Filter, X } from 'lucide-react';

export default function FilterToolbar({
  categories = [],
  selectedCategoryId = 'all',
  onSelectCategory,
  selectedStatus = 'all',
  onSelectStatus,
  selectedLocation = 'all',
  onSelectLocation,
  selectedWarranty = 'all',
  onSelectWarranty,
  onClearFilters,
}) {
  const locations = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];
  const hasActiveFilters = selectedCategoryId !== 'all' || selectedStatus !== 'all' || selectedLocation !== 'all' || selectedWarranty !== 'all';
  const safeCategories = Array.isArray(categories) ? categories : [];

  return (
    <div className="bg-surface/60 border border-border/60 rounded-xl p-4 space-y-3.5 shadow-sm">
      {/* Top row: Category chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        <span className="text-xs font-semibold text-secondary inline-flex items-center gap-1.5 shrink-0 mr-1">
          <Filter className="w-3.5 h-3.5 text-accent" />
          <span>Category:</span>
        </span>

        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
            selectedCategoryId === 'all'
              ? 'bg-accent text-white shadow-sm ring-2 ring-indigo-500/30 font-semibold'
              : 'bg-surface text-secondary border border-border hover:border-border'
          }`}
        >
          All Categories
        </button>

        {safeCategories.map((cat) => {
          const isActive = String(selectedCategoryId) === String(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-accent text-white shadow-sm ring-2 ring-indigo-500/30 font-semibold'
                  : 'bg-surface text-secondary border border-border hover:border-border'
              }`}
            >
              <Badge badgeChar={cat.badgeChar || cat.name} color={cat.color} className="!w-4 !h-4 !text-[9px]" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom row: Status dropdown, Location dropdown, Clear filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-secondary font-medium">
              Status:
            </label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(e) => onSelectStatus(e.target.value)}
              className="min-w-[120px] bg-surface border border-border rounded-lg px-2.5 py-1.5 text-primary focus:outline-none focus:ring-1 focus:ring-accent text-xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="available">🟢 Available</option>
              <option value="in-use">🔵 In Use</option>
              <option value="retired">⚪ Retired</option>
            </select>
          </div>

          {/* Location Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="location-filter" className="text-secondary font-medium">
              Location:
            </label>
            <select
              id="location-filter"
              value={selectedLocation}
              onChange={(e) => onSelectLocation(e.target.value)}
              className="min-w-[120px] bg-surface border border-border rounded-lg px-2.5 py-1.5 text-primary focus:outline-none focus:ring-1 focus:ring-accent text-xs cursor-pointer"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Warranty Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="warranty-filter" className="text-secondary font-medium">
              Warranty:
            </label>
            <select
              id="warranty-filter"
              value={selectedWarranty}
              onChange={(e) => onSelectWarranty(e.target.value)}
              className="min-w-[120px] bg-surface border border-border rounded-lg px-2.5 py-1.5 text-primary focus:outline-none focus:ring-1 focus:ring-accent text-xs cursor-pointer"
            >
              <option value="all">All Warranty</option>
              <option value="in-warranty">🛡️ In Warranty</option>
              <option value="expiring-soon">⚠️ Expiring Soon</option>
              <option value="expired">❌ Expired</option>
              <option value="no-warranty">⚪ No Warranty Data</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-danger bg-danger/10 hover:bg-danger/20 border border-danger/20 transition-colors cursor-pointer ml-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
