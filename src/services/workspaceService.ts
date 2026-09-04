import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { Workspace, WorkspaceMember } from '@/types/workspace';

export const workspaceService = {
  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    if (!supabaseConfig.isConfigured) return [];

    // Get workspaces where user is member or owner
    const { data: memberRows, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);

    if (memberError) {
      console.error('Error fetching user memberships:', memberError);
      return [];
    }

    const workspaceIds = memberRows?.map(m => m.workspace_id) || [];

    if (workspaceIds.length === 0) {
      // Also check owned workspaces directly
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId);

      if (ownedError) return [];
      return ownedWorkspaces || [];
    }

    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .or(`id.in.(${workspaceIds.join(',')}),owner_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (wsError) {
      console.error('Error fetching workspaces:', wsError);
      return [];
    }

    return workspaces || [];
  },

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    if (!supabaseConfig.isConfigured) return null;

    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching workspace:', error);
      return null;
    }

    return data;
  },

  async createWorkspace(name: string, ownerId: string): Promise<Workspace> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    // 1. Create the workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        owner_id: ownerId,
      })
      .select()
      .single();

    if (wsError) throw wsError;

    // 2. Add the owner as the first member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: ownerId,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding owner to workspace_members:', memberError);
      // Even if member insert fails, workspace was created, but log error
    }

    return workspace;
  },

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    if (!supabaseConfig.isConfigured) return [];

    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        workspace_id,
        user_id,
        role,
        joined_at,
        profile:profiles(id, username, display_name, avatar_url, created_at, updated_at)
      `)
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching workspace members:', error);
      return [];
    }

    // Map nested profile correctly
    return (data || []).map(m => ({
      id: m.id,
      workspace_id: m.workspace_id,
      user_id: m.user_id,
      role: m.role as 'owner' | 'member',
      joined_at: m.joined_at,
      profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
    }));
  },

  async joinWorkspaceByInvite(inviteCode: string): Promise<{ workspace_id: string; name: string }> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const cleanCode = inviteCode.trim();
    if (!cleanCode) {
      throw new Error('Invite code cannot be empty.');
    }

    const { data, error } = await supabase.rpc('join_workspace_by_invite', {
      code: cleanCode,
    });

    if (error) throw error;

    const result = data as { success: boolean; workspace_id: string; name: string; message?: string };
    if (!result?.workspace_id) {
      throw new Error('Failed to join workspace with provided code.');
    }

    return {
      workspace_id: result.workspace_id,
      name: result.name,
    };
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    if (!supabaseConfig.isConfigured) return;

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async updateWorkspace(workspaceId: string, updates: Partial<Pick<Workspace, 'name'>>): Promise<Workspace> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
