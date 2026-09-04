import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/types/project';

export const projectService = {
  async getProjects(workspaceId: string): Promise<Project[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          workspace_id,
          name,
          description,
          status,
          created_by,
          created_at,
          updated_at,
          creator:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        // Safety bound, not pagination.
        .limit(200);

      if (error) {
        console.error('Error fetching projects from Supabase:', error);
        throw new Error('Unable to load projects. Please try again.');
      }

      return (data || []).map((row) => ({
        id: row.id,
        workspace_id: row.workspace_id,
        name: row.name,
        description: row.description,
        status: row.status,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        creator: Array.isArray(row.creator) ? row.creator[0] : row.creator,
      }));
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Unable to')) {
        throw err;
      }
      throw new Error('An unexpected error occurred while loading projects.');
    }
  },

  async getProject(projectId: string): Promise<Project | null> {
    if (!supabaseConfig.isConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          workspace_id,
          name,
          description,
          status,
          created_by,
          created_at,
          updated_at,
          creator:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .eq('id', projectId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching project:', error);
        throw new Error('Unable to load project details.');
      }

      if (!data) return null;

      return {
        id: data.id,
        workspace_id: data.workspace_id,
        name: data.name,
        description: data.description,
        status: data.status,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
        creator: Array.isArray(data.creator) ? data.creator[0] : data.creator,
      };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Unable to')) {
        throw err;
      }
      throw new Error('Could not retrieve project.');
    }
  },

  async createProject(workspaceId: string, userId: string, input: CreateProjectInput): Promise<Project> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Project name cannot be empty.');
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          workspace_id: workspaceId,
          name: trimmedName,
          description: input.description?.trim() || null,
          status: input.status || 'PLANNING',
          created_by: userId,
        })
        .select(`
          id,
          workspace_id,
          name,
          description,
          status,
          created_by,
          created_at,
          updated_at,
          creator:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .single();

      if (error) {
        console.error('Error creating project:', error);
        throw new Error('Failed to create project. Check your permissions or try again.');
      }

      return {
        id: data.id,
        workspace_id: data.workspace_id,
        name: data.name,
        description: data.description,
        status: data.status,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
        creator: Array.isArray(data.creator) ? data.creator[0] : data.creator,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while creating the project.');
    }
  },

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const updates: Partial<{
      name: string;
      description: string | null;
      status: Project['status'];
      updated_at: string;
    }> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new Error('Project name cannot be empty.');
      updates.name = trimmed;
    }

    if (input.description !== undefined) {
      updates.description = input.description ? input.description.trim() : null;
    }

    if (input.status !== undefined) {
      updates.status = input.status;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select(`
          id,
          workspace_id,
          name,
          description,
          status,
          created_by,
          created_at,
          updated_at,
          creator:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .single();

      if (error) {
        console.error('Error updating project:', error);
        throw new Error('Failed to update project. You may not have permission.');
      }

      return {
        id: data.id,
        workspace_id: data.workspace_id,
        name: data.name,
        description: data.description,
        status: data.status,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
        creator: Array.isArray(data.creator) ? data.creator[0] : data.creator,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while updating the project.');
    }
  },

  async archiveProject(projectId: string): Promise<Project> {
    return this.updateProject(projectId, { status: 'ARCHIVED' });
  },

  async deleteProject(projectId: string): Promise<void> {
    if (!supabaseConfig.isConfigured) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('Error deleting project:', error);
        throw new Error('Failed to delete project. Only the creator or workspace owner can delete.');
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while deleting the project.');
    }
  },
};
