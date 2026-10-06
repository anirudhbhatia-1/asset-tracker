import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fetchQuery, getCacheGeneration, getQueryEntry, subscribeQuery } from '../utils/queryCache';

// The message to show for a failed load (null when it didn't fail).
// `withNetworkMessage: false` shows the fallback rather than axios' own text.
export const errorMessageOf = (err, fallback, { withNetworkMessage = true } = {}) => (
  err ? (err.response?.data?.message || (withNetworkMessage && err.message) || fallback) : null
);

/**
 * Reads `key` from the shared query cache and keeps it fresh: cached data is
 * shown at once and reloaded quietly in the background.
 *
 * - `loading`: nothing to show yet (first load) — render a skeleton.
 * - `refreshing`: rows are on screen and a newer copy is on its way.
 * - `keepPrevious`: while a new key (e.g. other filters) loads for the first
 *   time, keep showing the previous key's rows instead of a skeleton.
 * - `staleTime` (ms): skip the background reload when the cached copy is
 *   newer than this (shared lookups such as categories).
 * - `key` null: nothing is read or loaded.
 */
export default function useQuery(key, fetcher, { enabled = true, keepPrevious = false, staleTime = 0 } = {}) {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback((onChange) => subscribeQuery(key, onChange), [key]);
  const getSnapshot = useCallback(() => getQueryEntry(key), [key]);
  const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Last data shown, for keepPrevious (updated during render, React's
  // "adjust state while rendering" pattern). Remembered with the cache
  // generation, so rows from before a clear (another user or other
  // permissions) are never shown as a stand-in.
  const generationNow = getCacheGeneration();
  const [previous, setPrevious] = useState(() => ({ data: entry.data, generation: generationNow }));
  if (entry.data !== undefined && (entry.data !== previous.data || previous.generation !== generationNow)) {
    setPrevious({ data: entry.data, generation: generationNow });
  }
  const previousData = previous.generation === generationNow ? previous.data : undefined;

  const load = useCallback((options) => {
    if (key == null) return Promise.resolve(undefined);
    return fetchQuery(key, () => fetcherRef.current(), options);
  }, [key]);

  useEffect(() => {
    if (!enabled || key == null) return;
    const cached = getQueryEntry(key);
    if (staleTime > 0 && cached.data !== undefined && Date.now() - cached.updatedAt < staleTime) return;
    // Errors are kept on the entry and returned below.
    load().catch(() => {});
  }, [enabled, key, load, staleTime]);

  // Safety net: whenever there is nothing cached, nothing loading and no
  // error (e.g. right after the cache was cleared), load again rather than
  // showing a skeleton forever.
  const needsLoad = enabled && key != null && entry.data === undefined && !entry.fetching && !entry.error;
  useEffect(() => {
    if (needsLoad) load().catch(() => {});
  }, [needsLoad, load]);

  const refetch = useCallback(() => load({ force: true }).catch(() => undefined), [load]);

  const usePrevious = keepPrevious && entry.data === undefined && !entry.error && previousData !== undefined;
  const data = usePrevious ? previousData : entry.data;

  return {
    data,
    loading: data === undefined && !entry.error,
    refreshing: data !== undefined && (entry.fetching || usePrevious),
    isPlaceholder: usePrevious,
    error: entry.error,
    refetch,
  };
}

/**
 * For hooks whose page decides when (and with which filters) to load, via
 * `run(key, fetcher)`. Reads the last run's key from the cache like
 * useQuery. `initialKey` lets the first render show cached data for the
 * filters the page is about to load.
 */
export function useLazyQuery(initialKey = null, { keepPrevious = false } = {}) {
  const [activeKey, setActiveKey] = useState(initialKey);
  const keyRef = useRef(initialKey);
  const { data, loading, refreshing, isPlaceholder, error } = useQuery(activeKey, null, { enabled: false, keepPrevious });

  const run = useCallback((key, fetcher) => {
    keyRef.current = key;
    setActiveKey(key);
    return fetchQuery(key, fetcher);
  }, []);

  // Reloads the last run's key (forced: called after a change).
  const reload = useCallback(() => {
    const key = keyRef.current;
    const entry = getQueryEntry(key);
    if (key == null || !entry.fetcher) return Promise.resolve(undefined);
    return fetchQuery(key, entry.fetcher, { force: true });
  }, []);

  return {
    data,
    // Nothing run yet counts as loading, so pages show a skeleton, not an
    // empty state, before their first load.
    loading,
    refreshing,
    isPlaceholder,
    error,
    hasRun: activeKey !== null,
    activeKey,
    keyRef,
    run,
    reload,
  };
}
