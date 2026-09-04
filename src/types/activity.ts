import { Profile } from './auth';

// ── Core Activity Event ──────────────────────────────────────────────────────
// Mirrors public.activity_events. Rows are append-only and server-generated;
// the client never creates them.

export type ActivityEntityType =
  | 'project'
  | 'post'
  | 'comment'
  | 'task'
  | 'message'
  | 'file';

export interface ActivityEvent {
  id: string;
  workspace_id: string;
  project_id: string | null;
  actor_id: string | null;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Profile;
  project?: {
    id: string;
    name: string;
  } | null;
}
