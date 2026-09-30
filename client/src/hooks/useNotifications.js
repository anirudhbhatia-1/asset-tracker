import { useState, useCallback, useEffect, useRef } from 'react';
import { getNotifications } from '../api/notificationsApi';

// Matches the "Refreshes every 30s" note in the notification panel footer.
export const NOTIFICATION_POLL_INTERVAL_MS = 30000;
// Focus and visibilitychange often fire back to back; don't refetch twice.
const REFOCUS_MIN_GAP_MS = 5000;

export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasLoadedRef = useRef(false);
  const lastFetchAtRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    lastFetchAtRef.current = Date.now();
    // Only the first load shows the skeleton; background polls swap the
    // list in place so an open panel doesn't flicker every 30 seconds.
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const res = await getNotifications();
      const fetchedNotifications = res.data?.data || [];
      setNotifications(fetchedNotifications);
      hasLoadedRef.current = true;

      const lastRead = localStorage.getItem('last_notification_read_at');
      const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;

      const unread = fetchedNotifications.filter(n => new Date(n.createdAt).getTime() > lastReadTime);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll while the tab is visible; pause when hidden and catch up as soon as
  // the user comes back (visibilitychange or window focus).
  useEffect(() => {
    let intervalId = null;

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const startPolling = () => {
      stopPolling();
      intervalId = setInterval(fetchNotifications, NOTIFICATION_POLL_INTERVAL_MS);
    };
    const handleVisible = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      if (Date.now() - lastFetchAtRef.current >= REFOCUS_MIN_GAP_MS) {
        fetchNotifications();
        startPolling(); // restart so the next poll is a full interval away
      } else if (intervalId === null) {
        startPolling();
      }
    };

    fetchNotifications();
    if (!document.hidden) startPolling();

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(() => {
    localStorage.setItem('last_notification_read_at', new Date().toISOString());
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    loading,
    count: notifications.length,
    hasUnread: unreadCount > 0,
    refresh: fetchNotifications,
    markAsRead,
  };
}
