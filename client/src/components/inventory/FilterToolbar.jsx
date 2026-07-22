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
  onClearFilters,
}) {
  const locations = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];
  const hasActiveFilters = selectedCategoryId !== 'all' || selectedStatus !== 'all' || selectedLocation !== 'all';

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3.5 shadow-sm">
      {/* Top row: Category chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        <span className="text-xs font-semibold text-slate-400 inline-flex items-center gap-1.5 shrink-0 mr-1">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span>Category:</span>
        </span>

        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
            selectedCategoryId === 'all'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 font-semibold'
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
          }`}
        >
          All Categories
        </button>

        {categories.map((cat) => {
          const isActive = String(selectedCategoryId) === String(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 font-semibold'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
              }`}
            >
              <Badge badgeChar={cat.badgeChar || cat.name} color={cat.color} className="!w-4 !h-4 !text-[9px]" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom row: Status dropdown, Location dropdown, Clear filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/50 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-slate-400 font-medium">
              Status:
            </label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(e) => onSelectStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="available">🟢 Available</option>
              <option value="in-use">🔵 In Use</option>
              <option value="retired">⚪ Retired</option>
            </select>
          </div>

          {/* Location Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="location-filter" className="text-slate-400 font-medium">
              Location:
            </label>
            <select
              id="location-filter"
              value={selectedLocation}
              onChange={(e) => onSelectLocation(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer ml-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
