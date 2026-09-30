const crypto = require('crypto');

// Shared by the Excel (importExportService) and CSV (csvImportService)
// importers: cell unwrapping, header normalization, strict money/date parsing,
// stable generated serials and the prefetched lookups used for every row.

// ExcelJS may return formula cells as { formula, result }, rich-text cells as
// { richText } and hyperlinks as { text, hyperlink }. Normalize those shapes
// before validating import values.
const unwrapExcelValue = (val) => {
  if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, 'result')) {
    return val.result;
  }
  if (val && typeof val === 'object' && Array.isArray(val.richText)) {
    return val.richText.map((part) => part.text || '').join('');
  }
  if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, 'hyperlink')) {
    return val.text;
  }
  // A formula saved without a cached result has no value to import.
  if (val && typeof val === 'object' && ('formula' in val || 'sharedFormula' in val)) {
    return null;
  }
  return val;
};

const isBlankOrZero = (val) => {
  const value = unwrapExcelValue(val);
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return value === 0 || !Number.isFinite(value);
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  return trimmed === '' || /^[-+]?0(?:\.0+)?$/.test(trimmed);
};

const optionalExcelText = (val) => {
  if (isBlankOrZero(val)) return null;
  const text = String(unwrapExcelValue(val)).trim();
  return text || null;
};

// "Serial Number", "serial_number" and "Service / Warranty" all normalize to
// the same snake_case key, so columns are matched by name, not position.
const normalizeHeader = (value) => String(unwrapExcelValue(value) ?? '')
  .replace(/^﻿/, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

// "N/A", "none", "-" mean "nothing here" in legacy sheets, for serials,
// prices and dates alike.
const PLACEHOLDER_PATTERN = /^(n\/?a|none|nil|-+)$/i;

// ── Money ──
// cost_cents is an INTEGER, so the largest storable price is 21474836.47.
const MAX_COST_CENTS = 2147483647;
// Legacy sheets write "Free" / "FOC" (free of charge) for bundled items.
const FREE_PATTERN = /^(free|foc|free\s*of\s*cost)$/i;
const CURRENCY_PREFIX = /^(₹|rs\.?|inr)\s*/i;
const CURRENCY_SUFFIX = /\s*(₹|rs\.?|inr|\/-)$/i;

// Returns cents, null for blank, or undefined when the value is not a plain
// non-negative amount with at most two decimals ("1e3", "1.234,50", "-500").
const parseMoneyToCents = (val) => {
  const value = unwrapExcelValue(val);
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return undefined;
    const cents = Math.round(value * 100);
    return cents <= MAX_COST_CENTS ? cents : undefined;
  }
  const original = String(value).trim();
  if (!original || PLACEHOLDER_PATTERN.test(original)) return null;
  if (FREE_PATTERN.test(original)) return 0;
  const text = original
    .replace(CURRENCY_PREFIX, '')
    .replace(CURRENCY_SUFFIX, '')
    .replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return undefined;
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= MAX_COST_CENTS ? cents : undefined;
};

// ── Dates ──
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const toIsoDate = (year, month, day) => {
  if (year < MIN_YEAR || year > MAX_YEAR) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  return date.toISOString().substring(0, 10);
};

// Accepts 2025-02-17, 17/02/2025, 17-02-2025, 17.02.2025 (day first, as used
// in India) and 17 Feb 2025. Returns null for blank, undefined for invalid.
const parseCsvDate = (value) => {
  const text = optionalExcelText(value);
  if (!text || PLACEHOLDER_PATTERN.test(text)) return null;

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));

  match = text.match(/^(\d{1,2})[\s-]+([a-z]{3})[a-z]*[\s-]+(\d{4})$/i);
  if (match) {
    const month = MONTHS.indexOf(match[2].toLowerCase()) + 1;
    if (month > 0) return toIsoDate(Number(match[3]), month, Number(match[1]));
  }
  return undefined;
};

// Excel date (serial number, native Date cell, or day-first text) to
// YYYY-MM-DD. ExcelJS gives date cells as UTC midnight, so UTC getters keep
// the calendar day whatever the server's timezone is (IST would otherwise be
// fine but a US timezone would shift back a day). Null for blank or zero,
// undefined for invalid or out-of-range (years 1900–2100).
const parseImportDate = (val) => {
  if (isBlankOrZero(val)) return null;
  const value = unwrapExcelValue(val);

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return toIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return undefined;
    // Serial 25569 is 1970-01-01; the time of day (fraction) is ignored.
    const date = new Date((Math.floor(value) - 25569) * 86400 * 1000);
    return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  return parseCsvDate(value);
};

// ── Serials ──
// "2.44516E+17" is what Excel shows (and saves to CSV) for a long numeric
// serial; the real digits are already lost.
const SCIENTIFIC_SERIAL_PATTERN = /^[+-]?\d+(\.\d+)?e[+-]?\d+$/i;

// Stable per row content (never the row number), so re-importing the same
// file skips these rows as duplicates. Identical rows in one file are told
// apart by their occurrence counter.
const createSerialGenerator = (code) => {
  const seen = new Map();
  return (parts) => {
    const fingerprint = parts.map((part) => String(part ?? '').trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
    const occurrence = seen.get(fingerprint) || 0;
    seen.set(fingerprint, occurrence + 1);
    const hash = crypto.createHash('sha1').update(`${fingerprint}#${occurrence}`).digest('hex');
    return `NOSN-${code}-${hash.substring(0, 8).toUpperCase()}`;
  };
};

// ── Employees ──
// Names in legacy workbooks are not always formatted like the employee
// directory (for example "Arun Kumar" vs "Arunkumar", or "/ Intern").
// Normalize presentation-only differences, then resolve the one known legal
// name/email difference explicitly instead of using unsafe fuzzy matching.
const normalizeEmployeeImportName = (value) => {
  const text = optionalExcelText(value);
  if (!text) return '';
  return text
    .replace(/\s*\/\s*intern\s*$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const EMPLOYEE_IMPORT_EMAIL_ALIASES = Object.freeze({
  deebandhughosh: 'deebandu.ghosh@thinkvibes.com',
  lalitumpa: 'lalit.umap@thinkvibes.com',
  lalitvitthalraoumap: 'lalit.umap@thinkvibes.com',
  niteshkumarkumawat: 'nitesh.kumawat@thinkvibes.com',
  smitapandy: 'smita@thinkvibes.com',
});

// Loads everything a row may need to look up in four queries, so a large
// file costs O(1) lookups per row instead of one query each.
const loadImportLookups = async (databasePool) => {
  const [employees, categories, locations, assets] = await Promise.all([
    databasePool.query('SELECT id, name, email, deleted_at FROM employees'),
    databasePool.query('SELECT id, name FROM categories'),
    databasePool.query('SELECT name FROM locations'),
    databasePool.query('SELECT id, serial_number FROM assets'),
  ]);

  const employeesByEmail = new Map();
  const activeEmployeesByName = new Map();
  for (const employee of employees.rows) {
    const deleted = Boolean(employee.deleted_at);
    const email = employee.email ? String(employee.email).toLowerCase() : null;
    // An active record wins over a deleted one with the same email.
    if (email && (!employeesByEmail.has(email) || employeesByEmail.get(email).deleted)) {
      employeesByEmail.set(email, { id: employee.id, deleted });
    }
    if (!deleted) {
      const key = normalizeEmployeeImportName(employee.name);
      if (key) activeEmployeesByName.set(key, [...(activeEmployeesByName.get(key) || []), employee.id]);
    }
  }

  const categoryRows = categories.rows;
  return {
    categoryRows,
    categoriesByName: new Map(categoryRows.map((row) => [String(row.name).toLowerCase(), row])),
    locationRows: locations.rows,
    locationsByName: new Map(locations.rows.map((row) => [String(row.name).toLowerCase(), row.name])),
    assetIdsBySerial: new Map(assets.rows.map((row) => [String(row.serial_number).toLowerCase(), row.id])),

    // { id } for an active employee, { deleted: true } for a soft-deleted
    // one, { ambiguous: true } when a name matches several people, or null.
    resolveEmployee(value) {
      const identity = optionalExcelText(value);
      if (!identity) return null;
      const normalizedName = normalizeEmployeeImportName(identity);
      const email = identity.includes('@') ? identity.toLowerCase() : EMPLOYEE_IMPORT_EMAIL_ALIASES[normalizedName];
      if (email) {
        const match = employeesByEmail.get(email);
        if (!match) return null;
        return match.deleted ? { deleted: true } : { id: match.id };
      }
      const ids = activeEmployeesByName.get(normalizedName) || [];
      if (ids.length > 1) return { ambiguous: true };
      return ids.length === 1 ? { id: ids[0] } : null;
    },
  };
};

// Runs one row's writes inside a SAVEPOINT so a database error (e.g. a
// constraint violation) is reported for that row instead of aborting the
// whole import transaction.
const withRowSavepoint = async (client, work) => {
  await client.query('SAVEPOINT import_row');
  try {
    const result = await work();
    await client.query('RELEASE SAVEPOINT import_row');
    return { ok: true, result };
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT import_row');
    return { ok: false, error };
  }
};

module.exports = {
  unwrapExcelValue,
  isBlankOrZero,
  optionalExcelText,
  normalizeHeader,
  PLACEHOLDER_PATTERN,
  MAX_COST_CENTS,
  parseMoneyToCents,
  parseCsvDate,
  parseImportDate,
  SCIENTIFIC_SERIAL_PATTERN,
  createSerialGenerator,
  normalizeEmployeeImportName,
  EMPLOYEE_IMPORT_EMAIL_ALIASES,
  loadImportLookups,
  withRowSavepoint,
};
