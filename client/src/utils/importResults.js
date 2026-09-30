// Text helpers for Excel import results (ImportResultsPanel).

// "Laptops row 12 (SN-1): message; message" — one line per problem row.
export const formatImportError = (error) => {
  const where = [error.sheet, error.row ? `row ${error.row}` : null].filter(Boolean).join(' ');
  const serial = error.serial ? ` (${error.serial})` : '';
  const messages = Array.isArray(error.messages) ? error.messages.join('; ') : String(error.messages ?? '');
  return `${where}${serial}: ${messages}`;
};

// Every problem as one "reason" per line, for the downloadable CSV.
export const importProblemReasons = (result) => [
  ...(result.errors || []).map((error) => `Error: ${formatImportError(error)}`),
  ...(result.skipped || []).map((reason) => `Skipped: ${reason}`),
  ...(result.warnings || []).map((reason) => `Warning: ${reason}`),
];
