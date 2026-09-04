import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MoreVertical, Edit2, Trash2, ArrowRight, Folder } from 'lucide-react';
import { TaskFull, TaskStatus } from '@/types/task';
import { WorkspaceMember } from '@/types/workspace';
import { getDueDateInfo } from '@/lib/taskUtils';
import { cn } from '@/lib/utils';
import { PriorityBadge } from './PriorityBadge';
import { AssigneeChip } from './AssigneeSelector';

interface TaskCardProps {
  task: TaskFull;
  members: WorkspaceMember[];
  canEdit: boolean;
  onEdit: (task: TaskFull) => void;
  onDelete: (task: TaskFull) => void;
  onView: (task: TaskFull) => void;
  onStatusChange: (task: TaskFull, newStatus: TaskStatus) => void;
  /** When true the card is being dragged (dnd-kit injects this via useSortable) */
  isDragging?: boolean;
  showProject?: boolean;
}

const STATUS_TRANSITIONS: Record<TaskStatus, { label: string; status: TaskStatus }[]> = {
  TODO: [
    { label: 'Move to In Progress', status: 'IN_PROGRESS' },
    { label: 'Move to Done', status: 'DONE' },
  ],
  IN_PROGRESS: [
    { label: 'Move to To Do', status: 'TODO' },
    { label: 'Move to Done', status: 'DONE' },
  ],
  DONE: [
    { label: 'Move to In Progress', status: 'IN_PROGRESS' },
    { label: 'Move to To Do', status: 'TODO' },
  ],
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  members,
  canEdit,
  onEdit,
  onDelete,
  onView,
  onStatusChange,
  isDragging = false,
  showProject = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const dueDateInfo = getDueDateInfo(task.due_date);
  const assigneeMember = members.find((m) => m.user_id === task.assigned_to);

  return (
    <div
      className={cn(
        'group relative bg-card border border-border rounded-lg p-3 space-y-2.5 cursor-pointer select-none transition-shadow',
        isDragging ? 'shadow-xl rotate-1 opacity-90' : 'hover:shadow-md hover:border-primary/30'
      )}
      onClick={() => onView(task)}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 flex-1">
          {task.title}
        </p>

        {/* Actions menu — stops click propagation so card onClick doesn't fire */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            aria-label="Task actions"
            onClick={() => setMenuOpen((v) => !v)}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <>
              {/* Close layer */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-7 z-20 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1 text-xs">
                {/* Status transitions */}
                {STATUS_TRANSITIONS[task.status].map((t) => (
                  <button
                    key={t.status}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-muted-foreground hover:text-foreground"
                    onClick={() => { setMenuOpen(false); onStatusChange(task, t.status); }}
                  >
                    <ArrowRight className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}

                {canEdit && (
                  <>
                    <div className="border-t border-border my-1" />
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-muted-foreground hover:text-foreground"
                      onClick={() => { setMenuOpen(false); onEdit(task); }}
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit task
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-left text-destructive"
                      onClick={() => { setMenuOpen(false); onDelete(task); }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete task
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description excerpt */}
      {task.description && (
        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Meta row: priority + due date */}
      <div className="flex items-center gap-2 flex-wrap">
        <PriorityBadge priority={task.priority} />

        {dueDateInfo && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium',
              dueDateInfo.isOverdue
                ? 'text-red-400'
                : dueDateInfo.isToday
                  ? 'text-amber-400'
                  : 'text-muted-foreground'
            )}
            aria-label={dueDateInfo.label}
          >
            <Calendar className="h-2.5 w-2.5" aria-hidden />
            {dueDateInfo.isOverdue && <span aria-hidden>⚠</span>}
            {dueDateInfo.label}
          </span>
        )}
      </div>

      {/* Project badge (shown on global Tasks page) */}
      {showProject && task.project && (
        <div onClick={(e) => e.stopPropagation()}>
          <Link
            to={`/projects/${task.project_id}`}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded"
          >
            <Folder className="h-2.5 w-2.5" />
            {task.project.name}
          </Link>
        </div>
      )}

      {/* Assignee */}
      <div className="pt-0.5">
        <AssigneeChip member={assigneeMember} />
      </div>
    </div>
  );
};

