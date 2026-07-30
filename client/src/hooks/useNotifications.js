import { useState, useCallback, useEffect } from 'react';
import { getNotifications } from '../api/notificationsApi';

export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications();
      const fetchedNotifications = res.data?.data || [];
      setNotifications(fetchedNotifications);
      
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

  useEffect(() => {
    fetchNotifications();
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
