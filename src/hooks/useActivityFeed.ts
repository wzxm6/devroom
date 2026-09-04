import { useState, useEffect, useCallback } from 'react';
import { ActivityEvent } from '@/types/activity';
import { activityService } from '@/services/activityService';

interface UseActivityFeedOptions {
  workspaceId?: string;
  projectId?: string;
  limit?: number;
}

// Scoped activity feed. Poll-based by design: activity can be high-volume
// (every chat message emits an event) and nothing here needs realtime.
export const useActivityFeed = ({
  workspaceId,
  projectId,
  limit = 30,
}: UseActivityFeedOptions) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (projectId) {
        setEvents(await activityService.getProjectActivity(projectId, limit));
      } else if (workspaceId) {
        setEvents(await activityService.getWorkspaceActivity(workspaceId, limit));
      } else {
        setEvents([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load activity.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, limit]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  return {
    events,
    loading,
    error,
    refreshActivity: loadActivity,
  };
};
