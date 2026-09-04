// ── Core Notification ────────────────────────────────────────────────────────
// Mirrors public.notifications. Rows are server-generated; the client only
// reads them and flips read state through narrow RPCs.

export type NotificationType =
  | 'comment'
  | 'mention'
  | 'task_assigned'
  | 'task_completed';

export interface AppNotification {
  id: string;
  recipient_id: string;
  workspace_id: string;
  project_id: string | null;
  activity_event_id: string | null;
  notification_type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  project?: {
    id: string;
    name: string;
  } | null;
}

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  comment: 'Comment',
  mention: 'Mention',
  task_assigned: 'Task assigned',
  task_completed: 'Task completed',
};
