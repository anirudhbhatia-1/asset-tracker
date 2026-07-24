import { useState, useEffect, useCallback } from 'react';
import { getHistory } from '../api/historyApi';

export default function useHistory(limit = 20) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistoryData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const res = await getHistory(limit);
      setHistory(res.data?.data || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.message || 'Failed to load history events');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHistoryData(false);

    // Re-fetch when window gets focus
    const handleFocus = () => fetchHistoryData(true);
    window.addEventListener('focus', handleFocus);

    // Poll every 60 seconds in the background
    const intervalId = setInterval(() => {
      fetchHistoryData(true);
    }, 60000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [fetchHistoryData]);

  return { history: Array.isArray(history) ? history : [], loading, error, refresh: () => fetchHistoryData(false) };
}
