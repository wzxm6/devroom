import React from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { TaskFull, TaskStatus } from '@/types/task';
import { WorkspaceMember } from '@/types/workspace';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { getDueDateInfo } from '@/lib/taskUtils';
import { formatDate, formatTimeAgo, cn } from '@/lib/utils';
import { Calendar, Clock, User, CheckCircle2, Edit2, Trash2 } from 'lucide-react';

interface TaskDetailDialogProps {
  isOpen: boolean;
  task: TaskFull | null;
  onClose: () => void;
  onEdit: (task: TaskFull) => void;
  onDelete: (task: TaskFull) => void;
  onStatusChange: (task: TaskFull, newStatus: TaskStatus) => void;
  members: WorkspaceMember[];
  canManage: boolean;
}

export const TaskDetailDialog: React.FC<TaskDetailDialogProps> = ({
  isOpen,
  task,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  members,
  canManage,
}) => {
  if (!task) return null;

  const dueDateInfo = getDueDateInfo(task.due_date);
  const assigneeMember = members.find((m) => m.user_id === task.assigned_to);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Task Details"
    >
      <div className="space-y-5 pt-2">
        {/* Title and Badges */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {dueDateInfo && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border',
                  dueDateInfo.isOverdue
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : dueDateInfo.isToday
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-muted-foreground bg-muted border-border'
                )}
              >
                <Calendar className="h-3 w-3" />
                {dueDateInfo.label}
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-foreground leading-snug">
            {task.title}
          </h3>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Description
          </h4>
          <div className="rounded-md border border-border/80 bg-muted/20 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
            {task.description || (
              <span className="italic text-muted-foreground">No description provided.</span>
            )}
          </div>
        </div>

        {/* Status transitions */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Change Status
          </h4>
          <div className="flex flex-wrap gap-2">
            {(['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => onStatusChange(task, st)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 font-medium',
                  task.status === st
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                {st === 'TODO' ? 'To Do' : st === 'IN_PROGRESS' ? 'In Progress' : 'Done'}
              </button>
            ))}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border border-border/60 bg-card p-3.5 text-xs">
          {/* Assignee */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Assigned To
            </span>
            {assigneeMember ? (
              <div className="flex items-center gap-2 pt-0.5">
                <Avatar
                  size="xs"
                  src={assigneeMember.profile?.avatar_url}
                  name={assigneeMember.profile?.display_name}
                />
                <span className="font-medium text-foreground">
                  {assigneeMember.profile?.display_name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  @{assigneeMember.profile?.username}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground italic">Unassigned</span>
            )}
          </div>

          {/* Created By */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Created By
            </span>
            <div className="flex items-center gap-2 pt-0.5">
              <Avatar
                size="xs"
                src={task.creator?.avatar_url}
                name={task.creator?.display_name || 'Creator'}
              />
              <span className="font-medium text-foreground">
                {task.creator?.display_name || 'Team member'}
              </span>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Due Date
            </span>
            <span className="font-mono text-foreground">
              {task.due_date ? formatDate(task.due_date) : 'No due date set'}
            </span>
          </div>

          {/* Last Updated */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Updated
            </span>
            <span className="text-foreground">
              {formatTimeAgo(task.updated_at)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          {canManage ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
                className="text-xs h-8"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClose();
                  onDelete(task);
                }}
                className="text-xs h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>
          ) : (
            <div />
          )}

          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
