/**
 * Quotes a single CSV cell (RFC 4180): values containing commas, quotes,
 * line breaks or edge whitespace are wrapped in quotes with inner quotes doubled.
 */
export function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Builds CSV text from a header row and an array of row arrays. */
export function buildCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}

/** One "reason" column, one row per skipped import row. */
export function buildSkippedRowsCsv(reasons = []) {
  return buildCsv(['reason'], reasons.map((reason) => [reason]));
}

/** Triggers a browser download of CSV text. The BOM keeps Excel on UTF-8. */
export function downloadCsv(filename, csvText) {
  const blob = new Blob(['﻿', csvText], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
