import { useCallback } from 'react';
import { globalSearch } from '../api/searchApi';
import { queryKey } from '../utils/queryCache';
import { MIN_QUERY_LENGTH, MAX_QUERY_LENGTH } from '../utils/searchPalette';
import useDebouncedValue from './useDebouncedValue';
import useQuery, { errorMessageOf } from './useQuery';

export const SEARCH_DEBOUNCE_MS = 200;
export const SEARCH_LIMIT = 5;

/**
 * Global search for the command palette. Waits until typing pauses
 * (~200 ms) and the query has at least 2 characters; answers are cached
 * per query (a repeated search shows at once) and the previous answer stays
 * on screen while the next one loads.
 */
export default function useGlobalSearch(query, { enabled = true } = {}) {
  const trimmed = String(query || '').trim().slice(0, MAX_QUERY_LENGTH);
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const searchable = enabled && debounced.length >= MIN_QUERY_LENGTH;
  const key = searchable ? queryKey('search', { q: debounced, limit: SEARCH_LIMIT }) : null;
  const fetcher = useCallback(() => globalSearch(debounced, { limit: SEARCH_LIMIT }), [debounced]);
  const { data, loading, refreshing, error } = useQuery(key, fetcher, { enabled: searchable, keepPrevious: true });

  const tooShort = trimmed.length < MIN_QUERY_LENGTH;
  // Typing ahead of the debounce counts as loading, so "No results" never
  // flashes for a query that hasn't been sent yet.
  const pending = !tooShort && (debounced !== trimmed || loading || refreshing);

  return {
    // Answer for what is typed now, or the previous one while it loads.
    results: tooShort ? null : (data || null),
    loading: pending,
    // Answer is for the text currently typed (safe to say "No results").
    settled: !tooShort && !pending && debounced === trimmed,
    error: tooShort ? null : errorMessageOf(error, 'Search failed', { withNetworkMessage: false }),
  };
}
