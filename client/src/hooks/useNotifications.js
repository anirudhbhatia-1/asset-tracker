import { useState, useEffect, useCallback, useRef } from 'react';
import { getNotifications } from '../api/notificationsApi';

const POLL_INTERVAL_MS = 30000; // 30 seconds

export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data?.data || []);
    } catch (err) {
      // Silently fail — don't show error UI for background polling
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    count: notifications.length,
    hasUnread: notifications.length > 0,
    refresh: fetchNotifications,
  };
}
