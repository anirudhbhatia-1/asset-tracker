// Where an employee works. Mirrors the server's allowed values
// (employees.work_mode); 'office' is the default and shows no badge.

export const WORK_MODES = [
  { value: 'office', label: 'Office' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
];

export const DEFAULT_WORK_MODE = 'office';

const LABELS = Object.fromEntries(WORK_MODES.map((mode) => [mode.value, mode.label]));

/** Readable label; unknown or missing values count as Office. */
export const workModeLabel = (mode) => LABELS[mode] || LABELS[DEFAULT_WORK_MODE];

/** Known value or the default, for pre-filling a select. */
export const normalizeWorkMode = (mode) => (LABELS[mode] ? mode : DEFAULT_WORK_MODE);

/** Only Hybrid and Remote get a badge in lists. */
export const showsWorkModeBadge = (mode) => mode === 'hybrid' || mode === 'remote';

/** Directory filter: 'all' or one work mode (missing counts as Office). */
export const matchesWorkModeFilter = (employee, filter) => (
  !filter || filter === 'all' || normalizeWorkMode(employee?.workMode) === filter
);
