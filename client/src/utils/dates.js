// Calendar-date helpers. toISOString() is UTC, so in India it reports
// yesterday before 05:30; these use the browser's local calendar instead.

const pad = (value) => String(value).padStart(2, '0');

/** Local calendar date of `date` as YYYY-MM-DD. */
export const toLocalISODate = (date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

/** Today's local calendar date as YYYY-MM-DD (for date input defaults). */
export const todayLocalISO = () => toLocalISODate(new Date());

/** Local calendar date `days` from today as YYYY-MM-DD. */
export const addDaysLocalISO = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalISODate(date);
};

/**
 * Normalises a server date value for <input type="date">. DATE columns now
 * arrive as 'YYYY-MM-DD'; older timestamp strings are cut to their date part.
 */
export const toDateInputValue = (value) => (typeof value === 'string' ? value.substring(0, 10) : '');

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a server date value into a Date. Date-only strings ('YYYY-MM-DD')
 * become local midnight: new Date('2026-07-22') would be UTC midnight, which
 * shows as the previous day west of UTC. Timestamps ('YYYY-MM-DD HH:mm:ss'
 * or ISO) parse as before. Returns an Invalid Date for unusable input.
 */
export const parseDateValue = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== 'string' || !value) return new Date(NaN);
  const match = DATE_ONLY.exec(value.trim());
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value.replace(' ', 'T'));
};
