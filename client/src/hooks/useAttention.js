import { useMemo } from 'react';
import { getAttention } from '../api/dashboardApi';
import { normalizeAttention } from '../utils/attention';
import useQuery, { errorMessageOf } from './useQuery';

export const ATTENTION_KEY = 'dashboard/attention';
const fetchAttention = () => getAttention();

/**
 * What needs the user's attention (dashboard panel), from the shared cache:
 * shown at once on revisits and refreshed in the background; any change
 * the user saves elsewhere reloads it (see utils/queryCache).
 */
export default function useAttention({ enabled = true } = {}) {
  const { data, loading, refreshing, error, refetch } = useQuery(enabled ? ATTENTION_KEY : null, fetchAttention, { enabled });
  const items = useMemo(() => (data ? normalizeAttention(data) : []), [data]);
  return {
    items,
    loading,
    refreshing,
    error: errorMessageOf(error, 'Could not load what needs attention', { withNetworkMessage: false }),
    refresh: refetch,
  };
}
