import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AtSign,
  MessageSquare,
  CheckSquare,
  Flag,
  AlertCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { AppNotification, NotificationType, NOTIFICATION_LABELS } from '@/types/notification';
import { useNotifications } from '@/hooks/useNotifications';
import { buildDeepLink } from '@/lib/activityLinks';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { formatTimeAgo, cn } from '@/lib/utils';

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  comment: MessageSquare,
  mention: AtSign,
  task_assigned: CheckSquare,
  task_completed: Flag,
};

const NotificationRow: React.FC<{
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
}> = ({ notification, onOpen }) => {
  const Icon = TYPE_ICONS[notification.notification_type] || Bell;
  const link = buildDeepLink(notification);

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'w-full text-left flex items-start gap-3 py-3 px-2 first:pt-0 last:pb-0 rounded-md transition-colors',
        notification.is_read ? 'hover:bg-muted/30' : 'bg-primary/5 hover:bg-primary/10'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          notification.is_read
            ? 'border-border bg-muted/40 text-muted-foreground'
            : 'border-primary/30 bg-primary/10 text-primary'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {!notification.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
          <p className="text-xs font-semibold text-foreground truncate">{notification.title}</p>
        </div>
        {notification.body && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{notification.body}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
            {NOTIFICATION_LABELS[notification.notification_type]}
          </span>
          <span className="text-muted-foreground/60 text-[10px]">·</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatTimeAgo(notification.created_at)}
          </span>
          {notification.project && (
            <>
              <span className="text-muted-foreground/60 text-[10px]">·</span>
              <span className="text-[10px] text-primary truncate max-w-[140px]">
                {notification.project.name}
              </span>
            </>
          )}
        </div>
      </div>

      {link && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
    </button>
  );
};

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    operatingError,
    clearOperatingError,
    refreshNotifications,
    markRead,
    markAllRead,
  } = useNotifications();

  const handleOpen = async (notification: AppNotification) => {
    if (!notification.is_read) {
      try {
        await markRead(notification.id);
      } catch {
        // Error banner covers failures; still navigate so the tap is not lost
      }
    }
    const link = buildDeepLink(notification);
    if (link) navigate(link);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono border border-primary/20">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Mentions, comments on your posts, and task assignments.
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Live
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshNotifications}
            className="text-xs h-8 text-muted-foreground"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={handleMarkAllRead} className="text-xs h-8">
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {operatingError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 flex items-center justify-between gap-3">
          <span className="text-xs text-destructive truncate">{operatingError}</span>
          <button
            type="button"
            onClick={clearOperatingError}
            className="text-xs text-destructive hover:text-foreground shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Notification Center</CardTitle>
          <CardDescription>
            Real-time notifications sent when teammates interact with your work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-center space-y-3">
              <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
              <h4 className="text-xs font-semibold text-destructive">{error}</h4>
              <Button variant="outline" size="sm" onClick={refreshNotifications} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={CheckCheck}
              title="All caught up"
              description="You don't have any notifications yet. Mentions, comments, and task assignments will appear here in real time."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
