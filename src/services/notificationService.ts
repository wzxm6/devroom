import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { AppNotification } from '@/types/notification';

// Read + read-state only. Notifications are server-generated; there is
// intentionally no create API, and read flips go through narrow RPCs so the
// client can never change recipients, workspaces, types, or content.

const NOTIFICATION_SELECT = `
  id,
  recipient_id,
  workspace_id,
  project_id,
  activity_event_id,
  notification_type,
  title,
  body,
  entity_type,
  entity_id,
  is_read,
  created_at,
  read_at,
  project:projects(id, name)
`;

function mapRow(row: Record<string, unknown>): AppNotification {
  const projectRaw = row.project;
  const project: { id: string; name: string } | null = projectRaw
    ? (Array.isArray(projectRaw)
        ? (projectRaw[0] as { id: string; name: string }) ?? null
        : (projectRaw as { id: string; name: string }))
    : null;

  return {
    id: row.id as string,
    recipient_id: row.recipient_id as string,
    workspace_id: row.workspace_id as string,
    project_id: (row.project_id as string | null) ?? null,
    activity_event_id: (row.activity_event_id as string | null) ?? null,
    notification_type: row.notification_type as AppNotification['notification_type'],
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    entity_type: (row.entity_type as string | null) ?? null,
    entity_id: (row.entity_id as string | null) ?? null,
    is_read: row.is_read as boolean,
    created_at: row.created_at as string,
    read_at: (row.read_at as string | null) ?? null,
    project,
  };
}

export const notificationService = {
  /**
   * Current user's notifications, newest first. RLS restricts rows to the
   * authenticated recipient; the userId argument only scopes the query.
   */
  async getMyNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(NOTIFICATION_SELECT)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching notifications:', error);
        throw new Error('Unable to load notifications.');
      }

      return (data || []).map((row) => mapRow(row as unknown as Record<string, unknown>));
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading notifications.');
    }
  },

  /**
   * Count of unread notifications for the badge.
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!supabaseConfig.isConfigured) return 0;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }

      return count ?? 0;
    } catch {
      return 0;
    }
  },

  /**
   * Mark a single notification read via RPC (recipient-guarded server-side).
   */
  async markRead(notificationId: string): Promise<void> {
    if (!supabaseConfig.isConfigured) return;

    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (error) {
        console.error('Error marking notification read:', error);
        throw new Error('Failed to mark notification as read.');
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while updating the notification.');
    }
  },

  /**
   * Mark all of the current user's notifications read via RPC.
   */
  async markAllRead(): Promise<void> {
    if (!supabaseConfig.isConfigured) return;

    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');

      if (error) {
        console.error('Error marking all notifications read:', error);
        throw new Error('Failed to mark notifications as read.');
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while updating notifications.');
    }
  },
};
