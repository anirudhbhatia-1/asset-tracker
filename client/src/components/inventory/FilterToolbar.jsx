import React from 'react';
import Badge from '../ui/Badge';
import useLocations from '../../hooks/useLocations';
import { STATUS_OPTIONS, WARRANTY_OPTIONS } from './filterOptions';

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
}) {
  const { locations } = useLocations();
  const safeCategories = Array.isArray(categories) ? categories : [];

  return (
    <div className="bg-surface/60 border border-border/60 rounded-xl p-4 space-y-3.5 shadow-sm">
      {/* Top row: Category chips (wrap so none are cut off on small screens) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-secondary inline-flex items-center gap-1.5 shrink-0 mr-2 uppercase tracking-wider">
          Category:
        </span>

        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 active:scale-[0.97] shrink-0 cursor-pointer ${
            selectedCategoryId === 'all'
              ? 'bg-accent text-on-accent shadow-sm ring-2 ring-accent/30 font-semibold'
              : 'bg-surface text-secondary border border-border hover:bg-raised/70 hover:text-primary active:bg-raised'
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
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 active:scale-[0.97] shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-accent text-on-accent shadow-sm ring-2 ring-accent/30 font-semibold'
                  : 'bg-surface text-secondary border border-border hover:bg-raised/70 hover:text-primary active:bg-raised'
              }`}
            >
              <Badge badgeChar={cat.badgeChar || cat.name} color={cat.color} className="!w-4 !h-4 !text-[9px]" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom row: Status, Location, Warranty dropdowns (clearing lives in the active-filters row) */}
      <div className="pt-2 border-t border-border/50 text-xs">
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
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
              ))}
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
                <option key={loc.id} value={loc.name}>
                  {loc.name}
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
              {WARRANTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
