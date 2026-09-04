import { useState, useEffect, useCallback, useRef } from 'react';
import { TaskFull, TaskStatus, CreateTaskInput, UpdateTaskInput } from '@/types/task';
import { taskService } from '@/services/taskService';
import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { useWorkspace } from './useWorkspace';

export const useProjectTasks = (projectId: string | undefined) => {
  const { members } = useWorkspace();
  const [tasks, setTasks] = useState<TaskFull[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingError, setOperatingError] = useState<string | null>(null);

  // Ref to hold latest members so realtime callbacks do not need to re-subscribe on member updates
  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const loadTasks = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await taskService.getProjectTasks(projectId);
      setTasks(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load project tasks.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId || !supabaseConfig.isConfigured) return;

    const channelName = `project-tasks-${projectId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as {
              id: string;
              project_id: string;
              title: string;
              description: string | null;
              assigned_to: string | null;
              created_by: string;
              status: TaskStatus;
              priority: TaskFull['priority'];
              due_date: string | null;
              created_at: string;
              updated_at: string;
            };

            setTasks((prev) => {
              // Deduplicate if already present
              if (prev.some((t) => t.id === newRow.id)) return prev;

              const assignee =
                membersRef.current.find((m) => m.user_id === newRow.assigned_to)?.profile || null;
              const creator =
                membersRef.current.find((m) => m.user_id === newRow.created_by)?.profile || null;

              const taskWithProfiles: TaskFull = {
                ...newRow,
                assignee,
                creator,
              };

              return [taskWithProfiles, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as {
              id: string;
              status: TaskStatus;
              priority: TaskFull['priority'];
              title: string;
              description: string | null;
              assigned_to: string | null;
              due_date: string | null;
              updated_at: string;
            };

            setTasks((prev) =>
              prev.map((t) => {
                if (t.id !== updatedRow.id) return t;

                const assignee =
                  updatedRow.assigned_to === t.assigned_to
                    ? t.assignee
                    : membersRef.current.find((m) => m.user_id === updatedRow.assigned_to)?.profile || null;

                return {
                  ...t,
                  ...updatedRow,
                  assignee,
                };
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedRow = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== deletedRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Create Task
  const createTask = async (createdBy: string, input: CreateTaskInput): Promise<TaskFull> => {
    if (!projectId) throw new Error('Project ID is required.');
    const newTask = await taskService.createTask(projectId, createdBy, input);
    // Optimistically prepend to state (realtime insert will deduplicate)
    setTasks((prev) => {
      if (prev.some((t) => t.id === newTask.id)) return prev;
      return [newTask, ...prev];
    });
    return newTask;
  };

  // Update Task
  const updateTask = async (taskId: string, input: UpdateTaskInput): Promise<TaskFull> => {
    const updated = await taskService.updateTask(taskId, input);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    return updated;
  };

// Optimistic status update (e.g. for drag-and-drop or status menu)
  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    // 1. Snapshot previous state for rollback
    const originalTasks = [...tasks];
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;
    if (targetTask.status === newStatus) return;

    setOperatingError(null);

    // 2. Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t))
    );

    // 3. Send database update
    try {
      const serverUpdated = await taskService.updateTaskStatus(taskId, newStatus);
      // Synchronize with server response
      setTasks((prev) => prev.map((t) => (t.id === taskId ? serverUpdated : t)));
    } catch (err) {
      // 4. Rollback on failure
      setTasks(originalTasks);
      const msg = err instanceof Error ? err.message : 'Failed to move task.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  // Delete Task
  const deleteTask = async (taskId: string): Promise<void> => {
    await taskService.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

return {
    tasks,
    loading,
    error,
    operatingError,
    clearOperatingError: () => setOperatingError(null),
    refreshTasks: loadTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  };
};
