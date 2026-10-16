// Shared by FilterToolbar (dropdowns) and ActiveFilters (removable chips) so
// both always describe a filter value the same way.
export const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in-use', label: 'In Use' },
  { value: 'retired', label: 'Retired' },
  { value: 'returned', label: 'Returned to Client' },
];

export const WARRANTY_OPTIONS = [
  { value: 'in-warranty', label: 'In Warranty' },
  { value: 'expiring-soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'no-warranty', label: 'No Warranty Data' },
];

export const optionLabel = (options, value) => options.find((o) => o.value === value)?.label || value;
