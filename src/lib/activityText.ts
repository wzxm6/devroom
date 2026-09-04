import { ActivityEvent } from '@/types/activity';
import { TASK_STATUS_LABELS } from '@/types/task';

const prettifyStatus = (status: unknown): string => {
  if (typeof status === 'string' && status in TASK_STATUS_LABELS) {
    return TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS];
  }
  return String(status ?? '').replace(/_/g, ' ') || 'Unknown';
};

const metaString = (event: ActivityEvent, key: string): string => {
  const value = event.metadata[key];
  return typeof value === 'string' ? value : '';
};

// Human phrasing for raw action names. Never surfaces database internals.
export const describeActivity = (event: ActivityEvent): string => {
  const actor = event.actor?.display_name || 'Someone';
  const title = metaString(event, 'title');
  const quoted = title ? ` "${title}"` : '';

  switch (event.action) {
    case 'project.created':
      return `${actor} created project${quoted}`;
    case 'project.status_changed':
      return `${actor} moved${quoted} from ${prettifyStatus(event.metadata.old_status)} to ${prettifyStatus(event.metadata.new_status)}`;
    case 'project.updated':
      return `${actor} updated project${quoted}`;
    case 'project.deleted':
      return `${actor} deleted project${quoted}`;
    case 'post.created':
      return `${actor} posted${quoted}`;
    case 'post.updated':
      return `${actor} edited post${quoted}`;
    case 'post.deleted':
      return `${actor} deleted post${quoted}`;
    case 'comment.created':
      return `${actor} added a comment`;
    case 'comment.deleted':
      return `${actor} deleted a comment`;
    case 'task.created':
      return `${actor} created task${quoted}`;
    case 'task.status_changed':
      return event.metadata.new_status === 'DONE'
        ? `${actor} completed${quoted}`
        : `${actor} moved${quoted} to ${prettifyStatus(event.metadata.new_status)}`;
    case 'task.assigned':
      return `${actor} assigned task${quoted}`;
    case 'task.updated':
      return `${actor} updated task${quoted}`;
    case 'task.deleted':
      return `${actor} deleted task${quoted}`;
    case 'message.sent':
      return `${actor} sent a message`;
    case 'file.uploaded':
      return `${actor} uploaded ${metaString(event, 'filename') || 'a file'}`;
    case 'file.deleted':
      return `${actor} deleted ${metaString(event, 'filename') || 'a file'}`;
    default:
      return `${actor} made an update`;
  }
};

export const activityExcerpt = (event: ActivityEvent): string | null => {
  if (event.action === 'message.sent' || event.action === 'comment.created') {
    const excerpt = metaString(event, 'excerpt');
    return excerpt || null;
  }
  return null;
};
