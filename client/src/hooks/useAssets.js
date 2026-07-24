import { useState, useEffect, useCallback } from 'react';
import { getAssets } from '../api/assetsApi';

export default function useAssets(filters = {}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Serialize filters safely for dependency checking
  const filtersKey = JSON.stringify(filters);

  const fetchAssetsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAssets(filters);
      setAssets(res.data?.data || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    fetchAssetsData();
  }, [fetchAssetsData]);

  return { assets: Array.isArray(assets) ? assets : [], loading, error, refresh: fetchAssetsData };
}
