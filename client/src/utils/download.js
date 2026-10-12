import { toLocalISODate } from './dates';

/** Saves a downloaded blob (e.g. an Excel export) under `filename`. */
export function downloadBlob(data, filename) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick so every browser has started the download.
  setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

/**
 * "AssetTrack_2026-10-08.xlsx", optionally with a suffix before the
 * extension. Uses the local calendar date (toISOString is UTC, which east of
 * Greenwich still says yesterday in the morning).
 */
export const exportFilename = (suffix = '', date = new Date()) =>
  `AssetTrack_${toLocalISODate(date)}${suffix ? `_${suffix}` : ''}.xlsx`;

/**
 * The server's message for a failed blob request (the JSON error body comes
 * back as a Blob when responseType is 'blob'), or `fallback`.
 */
export async function blobErrorMessage(err, fallback) {
  const body = err?.response?.data;
  try {
    if (body && typeof body.text === 'function') {
      const parsed = JSON.parse(await body.text());
      if (parsed?.message) return parsed.message;
    } else if (body?.message) {
      return body.message;
    }
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
}
