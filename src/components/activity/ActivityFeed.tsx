import React from 'react';
import { Activity as ActivityIcon, AlertCircle, RefreshCw } from 'lucide-react';
import { ActivityEvent } from '@/types/activity';
import { ActivityItem } from './ActivityItem';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface ActivityFeedProps {
  events: ActivityEvent[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  compact?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  events,
  loading,
  error,
  onRefresh,
  compact = false,
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2.5">
            <Skeleton className="h-6 w-6 rounded-md shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center space-y-3">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
        <h4 className="text-xs font-semibold text-destructive">{error}</h4>
        <Button variant="outline" size="sm" onClick={onRefresh} className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Project updates, comments, and task changes will appear here as your team works."
      />
    );
  }

  return (
    <div className={compact ? 'divide-y divide-border/60' : 'space-y-1 divide-y divide-border/60'}>
      {events.map((event) => (
        <ActivityItem key={event.id} event={event} />
      ))}
    </div>
  );
};
