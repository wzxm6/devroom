import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { Task, TaskFull, TaskStatus, CreateTaskInput, UpdateTaskInput } from '@/types/task';
import { Profile } from '@/types/auth';

// ── Internal query helper ────────────────────────────────────────────────────

const TASK_SELECT = `
  id,
  project_id,
  title,
  description,
  assigned_to,
  created_by,
  status,
  priority,
  due_date,
  created_at,
  updated_at,
  project:projects(id, name),
  assignee:profiles!tasks_assigned_to_fkey(id, username, display_name, avatar_url, created_at, updated_at),
  creator:profiles!tasks_created_by_fkey(id, username, display_name, avatar_url, created_at, updated_at)
`;

function mapRow(row: Record<string, unknown>): TaskFull {
  const assigneeRaw = row.assignee;
  const creatorRaw = row.creator;
  const projectRaw = row.project;

  const assignee: Profile | null = assigneeRaw
    ? (Array.isArray(assigneeRaw) ? (assigneeRaw[0] as Profile) ?? null : (assigneeRaw as Profile))
    : null;
  const creator: Profile | null = creatorRaw
    ? (Array.isArray(creatorRaw) ? (creatorRaw[0] as Profile) ?? null : (creatorRaw as Profile))
    : null;
  const project: { id: string; name: string } | null = projectRaw
    ? (Array.isArray(projectRaw) ? (projectRaw[0] as { id: string; name: string }) ?? null : (projectRaw as { id: string; name: string }))
    : null;

  return {
    id: row.id as string,
    project_id: row.project_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    assigned_to: (row.assigned_to as string | null) ?? null,
    created_by: row.created_by as string,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    due_date: (row.due_date as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    assignee,
    creator,
    project,
  };
}


// ── Service ──────────────────────────────────────────────────────────────────

export const taskService = {
  /**
   * Fetch all tasks for a project, newest first.
   * Future activity hook: task_fetched (not needed individually).
   */
  async getProjectTasks(projectId: string): Promise<TaskFull[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        // Safety bound, not pagination.
        .limit(500);

      if (error) {
        console.error('Error fetching tasks:', error);
        throw new Error('Unable to load tasks.');
      }

      return (data || []).map((row) => mapRow(row as unknown as Record<string, unknown>));
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading tasks.');
    }
  },

  /**
   * Fetch a single task with full profile joins.
   */
  async getTask(taskId: string): Promise<TaskFull | null> {
    if (!supabaseConfig.isConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('id', taskId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching task:', error);
        throw new Error('Unable to load task details.');
      }

      if (!data) return null;
      return mapRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while loading the task.');
    }
  },

  /**
   * Create a new task.
   * Future activity hook: task_created
   */
  async createTask(projectId: string, createdBy: string, input: CreateTaskInput): Promise<TaskFull> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const title = input.title.trim();
    if (!title) throw new Error('Task title cannot be empty.');
    if (title.length > 500) throw new Error('Task title cannot exceed 500 characters.');
    if (input.description && input.description.length > 5000) {
      throw new Error('Task description cannot exceed 5000 characters.');
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title,
          description: input.description ?? null,
          assigned_to: input.assigned_to ?? null,
          created_by: createdBy,
          status: input.status ?? 'TODO',
          priority: input.priority ?? 'MEDIUM',
          due_date: input.due_date ?? null,
        })
        .select(TASK_SELECT)
        .single();

      if (error) {
        console.error('Error creating task:', error);
        throw new Error('Failed to create task. Check your permissions.');
      }

      return mapRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while creating the task.');
    }
  },

  /**
   * Update any fields of a task.
   * Future activity hook: task_updated, task_assigned, task_status_changed, task_completed
   */
  async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskFull> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const updates: {
      title?: string;
      description?: string | null;
      assigned_to?: string | null;
      status?: TaskStatus;
      priority?: Task['priority'];
      due_date?: string | null;
    } = {};
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (!t) throw new Error('Task title cannot be empty.');
      if (t.length > 500) throw new Error('Task title cannot exceed 500 characters.');
      updates.title = t;
    }
    if (input.description !== undefined) updates.description = input.description ?? null;
    if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to ?? null;
    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.due_date !== undefined) updates.due_date = input.due_date ?? null;


    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select(TASK_SELECT)
        .single();

      if (error) {
        console.error('Error updating task:', error);
        throw new Error('Failed to update task.');
      }

      return mapRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while updating the task.');
    }
  },

  /**
   * Update only the status field. Optimised for Kanban drag-and-drop.
   * Future activity hook: task_status_changed, task_completed
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<TaskFull> {
    return taskService.updateTask(taskId, { status });
  },

  /**
   * Assign (or un-assign) a task to a workspace member.
   * Future activity hook: task_assigned
   */
  async assignTask(taskId: string, userId: string | null): Promise<TaskFull> {
    return taskService.updateTask(taskId, { assigned_to: userId });
  },

  /**
   * Permanently delete a task. Only creator or workspace owner may do this (enforced by RLS).
   * Future activity hook: task_deleted
   */
  async deleteTask(taskId: string): Promise<void> {
    if (!supabaseConfig.isConfigured) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        throw new Error('Failed to delete task. You must be the creator or workspace owner.');
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while deleting the task.');
    }
  },

  /**
   * Fetch all tasks across all projects in a workspace the current user can access.
   * Used by the global /tasks page.
   */
  async getWorkspaceTasks(workspaceId?: string): Promise<TaskFull[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      if (workspaceId) {
        // Find projects belonging to this workspace
        const { data: projectRows, error: projectError } = await supabase
          .from('projects')
          .select('id')
          .eq('workspace_id', workspaceId);

        if (projectError) {
          console.error('Error fetching workspace projects for tasks:', projectError);
          throw new Error('Unable to load workspace tasks.');
        }

        const projectIds = (projectRows || []).map((p) => p.id);
        if (projectIds.length === 0) return [];

        const { data, error } = await supabase
          .from('tasks')
          .select(TASK_SELECT)
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          // Safety bound, not pagination.
          .limit(500);

        if (error) {
          console.error('Error fetching workspace tasks:', error);
          throw new Error('Unable to load workspace tasks.');
        }

        return (data || []).map((row) => mapRow(row as unknown as Record<string, unknown>));
      }

      // Fallback if no workspaceId is passed: RLS filters by current member's workspaces
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .order('created_at', { ascending: false })
        // Safety bound, not pagination.
        .limit(500);

      if (error) {
        console.error('Error fetching workspace tasks:', error);
        throw new Error('Unable to load workspace tasks.');
      }

      return (data || []).map((row) => mapRow(row as unknown as Record<string, unknown>));
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading workspace tasks.');
    }
  },
};

