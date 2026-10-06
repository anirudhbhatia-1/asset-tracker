import { getLocations } from '../api/locationsApi';
import useQuery from './useQuery';
import { LOOKUP_STALE_TIME } from './useCategories';
import toast from 'react-hot-toast';

const EMPTY = [];
export const LOCATIONS_KEY = 'locations';

// One request (and at most one toast) however many components ask at once.
const fetchLocationsList = async () => {
  try {
    const res = await getLocations();
    return res.data?.data || [];
  } catch (err) {
    console.error('Failed to fetch locations:', err);
    // Don't toast on a plain permission denial — it's an expected state, not an error.
    if (err.response?.status !== 403) {
      toast.error('Failed to load locations');
    }
    throw err;
  }
};

export default function useLocations(enabled = true) {
  const { data, loading, refetch } = useQuery(LOCATIONS_KEY, fetchLocationsList, { enabled, staleTime: LOOKUP_STALE_TIME });

  return {
    locations: Array.isArray(data) ? data : EMPTY,
    loading,
    refresh: refetch,
  };
}
