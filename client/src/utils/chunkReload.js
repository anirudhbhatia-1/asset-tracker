// After a deploy, an open tab still points at the previous build's lazy
// page files, which no longer exist: opening a page then fails with
// "Failed to fetch dynamically imported module" (or ChunkLoadError). One
// automatic reload picks up the new build. The time of that reload is kept
// in sessionStorage so a chunk that is truly missing can't loop.

export const CHUNK_RELOAD_KEY = 'assettrack:chunk-reload-at';
const RELOAD_GUARD_MS = 60 * 1000;

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (CSS )?chunk [\w-]+ failed|Unable to preload CSS/i;

export const isChunkLoadError = (error) => {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  return CHUNK_ERROR.test(String(error.message || error));
};

const safeStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

/**
 * Reloads the page unless it already did so in the last minute.
 * Returns true when a reload was started.
 */
export const reloadOnceForNewBuild = ({ storage = safeStorage(), reload = () => window.location.reload(), now = Date.now() } = {}) => {
  // Without storage there is no loop guard, so don't reload automatically.
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY)) || 0;
    if (now - last < RELOAD_GUARD_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
};
