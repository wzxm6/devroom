import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { ActivityEvent } from '@/types/activity';
import { Profile } from '@/types/auth';

// Deliberately read-only: activity rows are append-only and server-generated.
// There is intentionally no create/update/delete API on this service.

const ACTIVITY_SELECT = `
  id,
  workspace_id,
  project_id,
  actor_id,
  entity_type,
  entity_id,
  action,
  metadata,
  created_at,
  actor:profiles(id, username, display_name, avatar_url, created_at, updated_at),
  project:projects(id, name)
`;

function mapRow(row: Record<string, unknown>): ActivityEvent {
  const actorRaw = row.actor;
  const projectRaw = row.project;

  const actor: Profile | undefined = actorRaw
    ? (Array.isArray(actorRaw) ? (actorRaw[0] as Profile) : (actorRaw as Profile))
    : undefined;
  const project: { id: string; name: string } | null = projectRaw
    ? (Array.isArray(projectRaw)
        ? (projectRaw[0] as { id: string; name: string }) ?? null
        : (projectRaw as { id: string; name: string }))
    : null;

  let metadata: Record<string, unknown> = {};
  if (row.metadata && typeof row.metadata === 'object') {
    metadata = row.metadata as Record<string, unknown>;
  }

  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    project_id: (row.project_id as string | null) ?? null,
    actor_id: (row.actor_id as string | null) ?? null,
    entity_type: row.entity_type as ActivityEvent['entity_type'],
    entity_id: (row.entity_id as string | null) ?? null,
    action: row.action as string,
    metadata,
    created_at: row.created_at as string,
    actor,
    project,
  };
}

export const activityService = {
  /**
   * Latest workspace activity, newest first. Limit-capped for performance;
   * callers pass explicit limits (pagination-ready ordering).
   */
  async getWorkspaceActivity(workspaceId: string, limit = 30): Promise<ActivityEvent[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('activity_events')
        .select(ACTIVITY_SELECT)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching workspace activity:', error);
        throw new Error('Unable to load activity.');
      }

      return (data || []).map((row) => mapRow(row as unknown as Record<string, unknown>));
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading activity.');
    }
  },

  /**
   * Latest activity for a single project, newest first.
   */
  async getProjectActivity(projectId: string, limit = 30): Promise<ActivityEvent[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('activity_events')
        .select(ACTIVITY_SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching project activity:', error);
        throw new Error('Unable to load activity.');
      }

      return (data || []).map((row) => mapRow(row as unknown as Record<string, unknown>));
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading activity.');
    }
  },
};
