import React from 'react';
import { X } from 'lucide-react';
import { STATUS_OPTIONS, WARRANTY_OPTIONS, optionLabel } from './filterOptions';

// Removable chips for each active inventory filter. The ownership switch is a
// view, not a filter, so it is intentionally not listed here.
export default function ActiveFilters({
  searchQuery = '',
  selectedCategoryId = 'all',
  selectedStatus = 'all',
  selectedLocation = 'all',
  selectedWarranty = 'all',
  categories = [],
  onRemove,
  onClearAll,
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const chips = [];

  if (searchQuery) chips.push({ key: 'q', label: 'Search', value: `“${searchQuery}”` });
  if (selectedCategoryId !== 'all') {
    const cat = safeCategories.find((c) => String(c.id) === String(selectedCategoryId));
    chips.push({ key: 'categoryId', label: 'Category', value: cat?.name || `#${selectedCategoryId}` });
  }
  if (selectedStatus !== 'all') chips.push({ key: 'status', label: 'Status', value: optionLabel(STATUS_OPTIONS, selectedStatus) });
  if (selectedLocation !== 'all') chips.push({ key: 'location', label: 'Location', value: selectedLocation });
  if (selectedWarranty !== 'all') chips.push({ key: 'warranty', label: 'Warranty', value: optionLabel(WARRANTY_OPTIONS, selectedWarranty) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Active filters">
      <span className="font-semibold text-secondary uppercase tracking-wider mr-1">Active:</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 max-w-full"
        >
          <span className="truncate">
            <span className="text-secondary">{chip.label}:</span> <span className="font-medium">{chip.value}</span>
          </span>
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="p-0.5 rounded-full hover:bg-accent/20 transition-colors cursor-pointer shrink-0"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 font-medium text-secondary hover:text-primary underline underline-offset-2 cursor-pointer"
      >
        Clear all
      </button>
    </div>
  );
}
