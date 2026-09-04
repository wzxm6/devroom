import { Profile } from './auth';

export type WorkspaceRole = 'owner' | 'member';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  profile?: Profile;
}

export interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  userWorkspaces: Workspace[];
  members: WorkspaceMember[];
  memberCount: number;
  maxMembers: number;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace>;
  joinWorkspace: (inviteCode: string) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}
