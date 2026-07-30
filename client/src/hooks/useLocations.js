import { useState, useEffect, useCallback } from 'react';
import { getLocations } from '../api/locationsApi';
import toast from 'react-hot-toast';

export default function useLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLocations();
      setLocations(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return {
    locations,
    loading,
    refresh: fetchLocations,
  };
}
