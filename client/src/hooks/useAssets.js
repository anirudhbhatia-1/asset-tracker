import { useCallback } from 'react';
import { getAssets } from '../api/assetsApi';
import { queryKey } from '../utils/queryCache';
import useQuery, { errorMessageOf } from './useQuery';

const EMPTY = [];

export const listOf = (res) => res?.data?.data || (Array.isArray(res?.data) ? res.data : []);

export const assetsQueryKey = (filters = {}) => queryKey('assets', filters);
export const fetchAssetsList = (filters = {}) => getAssets(filters).then(listOf);

/**
 * Assets matching `filters`, from the shared cache when loaded before.
 * Changing filters keeps the current rows on screen (`showingPrevious`)
 * until the new ones arrive; responses for filters no longer shown are
 * ignored. `enabled: false` skips loading (e.g. while another view shows).
 */
export default function useAssets(filters = {}, { enabled = true } = {}) {
  const key = assetsQueryKey(filters);
  // Parsed back from the key so the fetcher only changes with the filters' values.
  const fetcher = useCallback(() => fetchAssetsList(Object.fromEntries(new URLSearchParams(key.split('?')[1] || ''))), [key]);
  const { data, loading, refreshing, isPlaceholder, error, refetch } = useQuery(key, fetcher, { enabled, keepPrevious: true });

  return {
    assets: Array.isArray(data) ? data : EMPTY,
    loading,
    refreshing,
    // Rows of the previous filters, shown until the new ones arrive.
    showingPrevious: isPlaceholder,
    error: errorMessageOf(error, 'Failed to load assets'),
    refresh: refetch,
  };
}
