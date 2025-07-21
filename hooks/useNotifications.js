// hooks/useNotifications.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch all notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setCurrentUser(null);
        return;
      }

      setCurrentUser(user);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const notificationList = data || [];
      const unreadList = notificationList.filter(n => !n.is_read);
      
      setNotifications(notificationList);
      setUnreadCount(unreadList.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      
      // Decrease unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      if (!currentUser) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [currentUser]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      const wasUnread = notifications.find(n => n.id === notificationId && !n.is_read);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Create new notification (for testing or admin purposes)
  const createNotification = useCallback(async (title, message, userId = null) => {
    try {
      const targetUserId = userId || currentUser?.id;
      if (!targetUserId) return;

      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            user_id: targetUserId,
            title,
            message,
            is_read: false,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }, [currentUser]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Set up real-time subscriptions
  useEffect(() => {
    let channel;

    if (currentUser) {
      channel = supabase
        .channel('user_notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
          },
          (payload) => {
            console.log('Notification change detected:', payload);
            
            if (payload.eventType === 'INSERT') {
              // New notification added
              const newNotification = payload.new;
              setNotifications(prev => [newNotification, ...prev]);
              if (!newNotification.is_read) {
                setUnreadCount(prev => prev + 1);
              }
            } else if (payload.eventType === 'UPDATE') {
              // Notification updated
              const updatedNotification = payload.new;
              setNotifications(prev => 
                prev.map(n => 
                  n.id === updatedNotification.id ? updatedNotification : n
                )
              );
              // Recalculate unread count
              fetchNotifications();
            } else if (payload.eventType === 'DELETE') {
              // Notification deleted
              const deletedId = payload.old.id;
              const wasUnread = payload.old.is_read === false;
              setNotifications(prev => prev.filter(n => n.id !== deletedId));
              if (wasUnread) {
                setUnreadCount(prev => Math.max(0, prev - 1));
              }
            }
          }
        )
        .subscribe();
    }

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setNotifications([]);
          setUnreadCount(0);
          setCurrentUser(null);
        } else if (event === 'SIGNED_IN' && session?.user) {
          setCurrentUser(session.user);
        }
      }
    );

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      subscription?.unsubscribe();
    };
  }, [currentUser?.id, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    refreshNotifications: fetchNotifications,
  };
};