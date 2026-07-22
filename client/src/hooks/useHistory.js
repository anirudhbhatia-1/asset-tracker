import { useState, useEffect, useCallback } from 'react';
import { getHistory } from '../api/historyApi';

export default function useHistory(limit = 20) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistoryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHistory(limit);
      setHistory(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load history events');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

  return { history, loading, error, refresh: fetchHistoryData };
}
