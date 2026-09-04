import { useState, useEffect, useCallback } from 'react';
import { AppNotification } from '@/types/notification';
import { notificationService } from '@/services/notificationService';
import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { useAuth } from './useAuth';

type RawNotificationRow = {
  id: string;
  recipient_id: string;
  workspace_id: string;
  project_id: string | null;
  activity_event_id: string | null;
  notification_type: AppNotification['notification_type'];
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

let notificationsChannelSeq = 0;

export const useNotifications = () => {
  const { user } = useAuth();
  const userId = user?.id;
  // Unique channel per hook instance. The Supabase client returns the SAME
  // channel object for duplicate topic names, and realtime-js throws when
  // .on() is called on an already-subscribed channel — so two mounted
  // instances (e.g. TopBar badge + Dashboard banner) must never share a
  // topic, or the second mount crashes inside its subscription effect.
  const [instanceId] = useState(() => {
    notificationsChannelSeq += 1;
    return notificationsChannelSeq;
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingError, setOperatingError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotifications(await notificationService.getMyNotifications(userId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load notifications.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription, narrowly scoped to the authenticated recipient.
  // Never subscribes workspace-wide: other users' notifications must not
  // arrive in this browser at all.
  useEffect(() => {
    if (!userId || !supabaseConfig.isConfigured) return;

    const channelName = `user-notifications-${userId}-${instanceId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as RawNotificationRow;
            // Defensive recipient check on top of the server-side filter
            if (newRow.recipient_id !== userId) return;

            setNotifications((prev) => {
              // Deduplicate against the initial fetch racing the event
              if (prev.some((n) => n.id === newRow.id)) return prev;
              const incoming: AppNotification = { ...newRow, project: null };
              return [incoming, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as RawNotificationRow;
            if (updatedRow.recipient_id !== userId) return;

            setNotifications((prev) =>
              prev.map((n) =>
                n.id === updatedRow.id
                  ? { ...n, is_read: updatedRow.is_read, read_at: updatedRow.read_at }
                  : n
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedRow = payload.old as { id: string };
            setNotifications((prev) => prev.filter((n) => n.id !== deletedRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  // Optimistic single mark-read with rollback
  const markRead = async (notificationId: string): Promise<void> => {
    const original = [...notifications];
    setOperatingError(null);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      )
    );

    try {
      await notificationService.markRead(notificationId);
    } catch (err) {
      setNotifications(original);
      const msg = err instanceof Error ? err.message : 'Failed to update notification.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  // Optimistic mark-all-read with rollback
  const markAllRead = async (): Promise<void> => {
    const original = [...notifications];
    setOperatingError(null);
    setNotifications((prev) =>
      prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() }))
    );

    try {
      await notificationService.markAllRead();
    } catch (err) {
      setNotifications(original);
      const msg = err instanceof Error ? err.message : 'Failed to update notifications.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    operatingError,
    clearOperatingError: () => setOperatingError(null),
    refreshNotifications: loadNotifications,
    markRead,
    markAllRead,
  };
};
