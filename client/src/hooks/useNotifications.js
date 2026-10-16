import { useState, useCallback, useEffect, useRef } from 'react';
import { getNotifications } from '../api/notificationsApi';
import { useAuth } from '../context/AuthContext';

// Matches the "Refreshes every 30s" note in the notification panel footer.
export const NOTIFICATION_POLL_INTERVAL_MS = 30000;
// Focus and visibilitychange often fire back to back; don't refetch twice.
const REFOCUS_MIN_GAP_MS = 5000;

// "Read up to" marker, kept per account so people sharing a browser don't
// clear each other's unread dot. Storage can be unavailable (private mode,
// blocked site data); then nothing is remembered.
const readMarkerKey = (userId) => `last_notification_read_at:${userId ?? 'anonymous'}`;
const readLastReadAt = (userId) => {
  try {
    return localStorage.getItem(readMarkerKey(userId));
  } catch {
    return null;
  }
};
const writeLastReadAt = (userId, value) => {
  try {
    localStorage.setItem(readMarkerKey(userId), value);
  } catch {
    // Not persisted; the badge still clears for this session.
  }
};

export default function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
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

      const lastRead = readLastReadAt(userId);
      const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;

      const unread = fetchedNotifications.filter(n => new Date(n.createdAt).getTime() > lastReadTime);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
    writeLastReadAt(userId, new Date().toISOString());
    setUnreadCount(0);
  }, [userId]);

  return {
    notifications,
    loading,
    count: notifications.length,
    hasUnread: unreadCount > 0,
    refresh: fetchNotifications,
    markAsRead,
  };
}
