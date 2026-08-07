import { useState, useEffect, useCallback } from 'react';
import { getLocations } from '../api/locationsApi';
import toast from 'react-hot-toast';

export default function useLocations(enabled = true) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLocations();
      setLocations(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      // Don't toast on a plain permission denial — it's an expected state, not an error.
      if (err.response?.status !== 403) {
        toast.error('Failed to load locations');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchLocations();
  }, [enabled, fetchLocations]);

  return {
    locations,
    loading,
    refresh: fetchLocations,
  };
}
