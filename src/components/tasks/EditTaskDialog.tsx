import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TaskFull, UpdateTaskInput, TaskPriority, TaskStatus, ALL_PRIORITIES, ALL_STATUSES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/task';
import { WorkspaceMember } from '@/types/workspace';
import { AssigneeSelector } from './AssigneeSelector';
import { AlertCircle } from 'lucide-react';

interface EditTaskDialogProps {
  isOpen: boolean;
  task: TaskFull | null;
  onClose: () => void;
  onSubmit: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  members: WorkspaceMember[];
}

export const EditTaskDialog: React.FC<EditTaskDialogProps> = ({
  isOpen,
  task,
  onClose,
  onSubmit,
  members,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setAssignedTo(task.assigned_to);
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
      setError(null);
    }
  }, [task, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Task title cannot be empty.');
      return;
    }
    if (trimmedTitle.length > 500) {
      setError('Task title cannot exceed 500 characters.');
      return;
    }
    if (description.trim().length > 5000) {
      setError('Description cannot exceed 5000 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit(task.id, {
        title: trimmedTitle,
        description: description.trim() || null,
        assigned_to: assignedTo,
        status,
        priority,
        due_date: dueDate || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Task"
      description="Update task details, assignment, or priority."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="rounded-md bg-destructive/15 border border-destructive/20 p-2.5 flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="edit-task-title" className="text-xs font-semibold text-foreground">
            Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="edit-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="edit-task-description" className="text-xs font-semibold text-foreground">
            Description
          </label>
          <textarea
            id="edit-task-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Grid: Status & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="edit-task-status" className="text-xs font-semibold text-foreground">
              Status
            </label>
            <select
              id="edit-task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {TASK_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-task-priority" className="text-xs font-semibold text-foreground">
              Priority
            </label>
            <select
              id="edit-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {ALL_PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {TASK_PRIORITY_LABELS[pr]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid: Assignee & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Assignee
            </label>
            <AssigneeSelector
              members={members}
              value={assignedTo}
              onChange={setAssignedTo}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-task-due-date" className="text-xs font-semibold text-foreground">
              Due Date
            </label>
            <Input
              id="edit-task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading || !title.trim()}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
