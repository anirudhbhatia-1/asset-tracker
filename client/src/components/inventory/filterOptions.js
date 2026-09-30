// Shared by FilterToolbar (dropdowns) and ActiveFilters (removable chips) so
// both always describe a filter value the same way.
export const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', icon: '🟢' },
  { value: 'in-use', label: 'In Use', icon: '🔵' },
  { value: 'retired', label: 'Retired', icon: '⚪' },
  { value: 'returned', label: 'Returned to Client', icon: '↩️' },
];

export const WARRANTY_OPTIONS = [
  { value: 'in-warranty', label: 'In Warranty', icon: '🛡️' },
  { value: 'expiring-soon', label: 'Expiring Soon', icon: '⚠️' },
  { value: 'expired', label: 'Expired', icon: '❌' },
  { value: 'no-warranty', label: 'No Warranty Data', icon: '⚪' },
];

export const optionLabel = (options, value) => options.find((o) => o.value === value)?.label || value;
