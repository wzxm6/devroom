import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  RefreshCw,
  AlertCircle,
  FolderPlus,
  AlertTriangle,
} from 'lucide-react';
import { TaskFull, TaskStatus, UpdateTaskInput } from '@/types/task';
import { taskService } from '@/services/taskService';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskFiltersBar, TaskFilterValues } from '@/components/tasks/TaskFiltersBar';
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { DeleteTaskDialog } from '@/components/tasks/DeleteTaskDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDueDateInfo } from '@/lib/taskUtils';

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace, members, isOwner } = useWorkspace();

  const [tasks, setTasks] = useState<TaskFull[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingError, setOperatingError] = useState<string | null>(null);

  // Filter and view states
  const [filters, setFilters] = useState<TaskFilterValues>({
    search: '',
    status: 'ALL',
    priority: 'ALL',
    assignedToMe: false,
    overdue: false,
  });
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Dialog states
  const [taskForEdit, setTaskForEdit] = useState<TaskFull | null>(null);
  const [taskForDelete, setTaskForDelete] = useState<TaskFull | null>(null);
  const [taskForDetail, setTaskForDetail] = useState<TaskFull | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!currentWorkspace) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await taskService.getWorkspaceTasks(currentWorkspace.id);
      setTasks(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load workspace tasks.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Task Handlers
  const handleUpdateTask = async (taskId: string, input: UpdateTaskInput) => {
    const updated = await taskService.updateTask(taskId, input);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    if (taskForDetail && taskForDetail.id === taskId) {
      setTaskForDetail((prev) => (prev ? { ...prev, ...input } : null));
    }
  };

  const handleStatusChange = async (task: TaskFull, newStatus: TaskStatus) => {
    const originalTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t))
    );
    setOperatingError(null);

    try {
      const updated = await taskService.updateTaskStatus(task.id, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (taskForDetail && taskForDetail.id === task.id) {
        setTaskForDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      setTasks(originalTasks);
      const msg = err instanceof Error ? err.message : 'Failed to move task.';
      setOperatingError(msg);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await taskService.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (taskForDetail && taskForDetail.id === taskId) {
      setTaskForDetail(null);
    }
  };

  const canManageTask = (task: TaskFull) => {
    if (!user) return false;
    return task.created_by === user.id || task.assigned_to === user.id || isOwner;
  };

  // Client-side filtering
  const filteredTasks = tasks.filter((t) => {
    if (filters.assignedToMe && user && t.assigned_to !== user.id) {
      return false;
    }
    if (filters.status !== 'ALL' && t.status !== filters.status) {
      return false;
    }
    if (filters.priority !== 'ALL' && t.priority !== filters.priority) {
      return false;
    }
    if (filters.overdue) {
      if (t.status === 'DONE' || !t.due_date) return false;
      const info = getDueDateInfo(t.due_date);
      if (!info?.isOverdue) return false;
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) || false;
      const matchProject = t.project?.name.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchDesc && !matchProject) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-amber-400" />
              Workspace Tasks
            </h1>
            {tasks.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-mono text-muted-foreground">
                {tasks.length} total
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Global Kanban board and searchable task registry across all projects in{' '}
            <strong className="text-foreground">{currentWorkspace?.name || 'this workspace'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchTasks} className="text-xs h-8 text-muted-foreground">
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/projects')}
            className="text-xs h-8"
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1" />
            Go to Projects
          </Button>
        </div>
      </div>

      {/* Operating Error Banner */}
      {operatingError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive">{operatingError}</span>
          </div>
          <button
            onClick={() => setOperatingError(null)}
            className="text-xs text-destructive hover:text-foreground shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toolbar & Filters */}
      <TaskFiltersBar
        filters={filters}
        onChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNewTask={() => navigate('/projects')}
        canCreate={false}
      />

      {/* Error State */}
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <h4 className="text-xs font-semibold text-destructive">{error}</h4>
          <Button variant="outline" size="sm" onClick={fetchTasks} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((col) => (
            <div key={col} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState
              icon={CheckSquare}
              title="No tasks recorded in this workspace"
              description="Navigate to any project to create tasks, assign work, and track sprint progress."
              actionLabel="View Projects"
              onAction={() => navigate('/projects')}
            />
          </CardContent>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState
              icon={CheckSquare}
              title="No tasks match your filters"
              description={
                filters.assignedToMe
                  ? "You don't have any tasks assigned to you right now."
                  : "Try adjusting your search query, priority, or status filters."
              }
              actionLabel="Clear Filters"
              onAction={() =>
                setFilters({
                  search: '',
                  status: 'ALL',
                  priority: 'ALL',
                  assignedToMe: false,
                  overdue: false,
                })
              }
            />
          </CardContent>
        </Card>
      ) : viewMode === 'board' ? (
        <TaskBoard
          tasks={filteredTasks}
          members={members}
          canManageTask={canManageTask}
          onEdit={(task) => setTaskForEdit(task)}
          onDelete={(task) => setTaskForDelete(task)}
          onView={(task) => setTaskForDetail(task)}
          onStatusChange={handleStatusChange}
          showProject
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          members={members}
          canManageTask={canManageTask}
          onEdit={(task) => setTaskForEdit(task)}
          onDelete={(task) => setTaskForDelete(task)}
          onView={(task) => setTaskForDetail(task)}
          onStatusChange={handleStatusChange}
          showProject
        />
      )}

      {/* Edit Task Dialog */}
      <EditTaskDialog
        isOpen={Boolean(taskForEdit)}
        task={taskForEdit}
        onClose={() => setTaskForEdit(null)}
        onSubmit={handleUpdateTask}
        members={members}
      />

      {/* Delete Task Dialog */}
      <DeleteTaskDialog
        isOpen={Boolean(taskForDelete)}
        task={taskForDelete}
        onClose={() => setTaskForDelete(null)}
        onConfirm={handleDeleteTask}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        isOpen={Boolean(taskForDetail)}
        task={taskForDetail}
        onClose={() => setTaskForDetail(null)}
        onEdit={(task) => setTaskForEdit(task)}
        onDelete={(task) => setTaskForDelete(task)}
        onStatusChange={handleStatusChange}
        members={members}
        canManage={Boolean(taskForDetail && canManageTask(taskForDetail))}
      />
    </div>
  );
};

export default TasksPage;

