export const RECENT_SCANS_LIMIT = 5;
export const RECENT_SCANS_STORAGE_KEY = 'scanner_recent_scans';

/**
 * Puts the asset at the front of the recent-scans list (moving it up if it
 * was already there) and keeps only the newest `limit` entries. Stores just
 * what the list shows, not the whole asset record.
 */
export function addRecentScan(list, asset, limit = RECENT_SCANS_LIMIT) {
  if (!asset?.id) return Array.isArray(list) ? list : [];
  const entry = {
    id: asset.id,
    name: asset.name,
    serialNumber: asset.serialNumber,
    status: asset.status,
    assetType: asset.assetType,
  };
  const rest = (Array.isArray(list) ? list : []).filter((item) => item.id !== asset.id);
  return [entry, ...rest].slice(0, limit);
}

// sessionStorage can throw (private mode, blocked storage); the list is a
// convenience, so failures just mean starting empty.
export function loadRecentScans() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(RECENT_SCANS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_SCANS_LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveRecentScans(list) {
  try {
    sessionStorage.setItem(RECENT_SCANS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
