import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskFull, TaskStatus } from '@/types/task';
import { WorkspaceMember } from '@/types/workspace';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { AssigneeChip } from './AssigneeSelector';
import { getDueDateInfo } from '@/lib/taskUtils';
import { formatTimeAgo, cn } from '@/lib/utils';
import { Calendar, MoreVertical, Edit2, Trash2, ArrowUpDown, Folder } from 'lucide-react';

interface TaskListProps {
  tasks: TaskFull[];
  members: WorkspaceMember[];
  canManageTask: (task: TaskFull) => boolean;
  onEdit: (task: TaskFull) => void;
  onDelete: (task: TaskFull) => void;
  onView: (task: TaskFull) => void;
  onStatusChange: (task: TaskFull, newStatus: TaskStatus) => void;
  showProject?: boolean;
}

type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'updated_at' | 'project';

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  members,
  canManageTask,
  onEdit,
  onDelete,
  onView,
  onStatusChange,
  showProject = false,
}) => {

  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const priorityWeight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const statusWeight = { TODO: 1, IN_PROGRESS: 2, DONE: 3 };

  const sortedTasks = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortField === 'status') {
      cmp = statusWeight[a.status] - statusWeight[b.status];
    } else if (sortField === 'priority') {
      cmp = priorityWeight[a.priority] - priorityWeight[b.priority];
    } else if (sortField === 'due_date') {
      const d1 = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const d2 = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      cmp = d1 - d2;
    } else if (sortField === 'project') {
      const p1 = a.project?.name || '';
      const p2 = b.project?.name || '';
      cmp = p1.localeCompare(p2);
    } else if (sortField === 'updated_at') {
      cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    }
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium select-none">
            <tr>
              <th
                className="py-2.5 px-4 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Task</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              {showProject && (
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('project')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Project</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Priority</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">Assignee</th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('due_date')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Due Date</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('updated_at')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Updated</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedTasks.map((task) => {
              const assigneeMember = members.find((m) => m.user_id === task.assigned_to);
              const dueDateInfo = getDueDateInfo(task.due_date);
              const canEdit = canManageTask(task);
              const isMenuOpen = openMenuTaskId === task.id;

              return (
                <tr
                  key={task.id}
                  onClick={() => onView(task)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  {/* Title & Description */}
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-medium text-foreground truncate">
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                        {task.description}
                      </div>
                    )}
                  </td>

                  {/* Project Link if showProject */}
                  {showProject && (
                    <td
                      className="py-3 px-3 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.project ? (
                        <Link
                          to={`/projects/${task.project_id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <Folder className="h-3 w-3" />
                          {task.project.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  )}


                  {/* Status */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <StatusBadge status={task.status} />
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <PriorityBadge priority={task.priority} />
                  </td>

                  {/* Assignee */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <AssigneeChip member={assigneeMember} />
                  </td>

                  {/* Due Date */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {dueDateInfo ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-medium',
                          dueDateInfo.isOverdue
                            ? 'text-red-400'
                            : dueDateInfo.isToday
                              ? 'text-amber-400'
                              : 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="h-3 w-3" />
                        {dueDateInfo.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>

                  {/* Updated */}
                  <td className="py-3 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                    {formatTimeAgo(task.updated_at)}
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3 px-3 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative inline-block text-left">
                      <button
                        onClick={() => setOpenMenuTaskId(isMenuOpen ? null : task.id)}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuTaskId(null)}
                          />
                          <div className="absolute right-0 top-7 z-20 min-w-[150px] bg-popover border border-border rounded-md shadow-lg py-1 text-xs text-left">
                            <button
                              className="w-full px-3 py-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setOpenMenuTaskId(null);
                                onStatusChange(
                                  task,
                                  task.status === 'TODO'
                                    ? 'IN_PROGRESS'
                                    : task.status === 'IN_PROGRESS'
                                      ? 'DONE'
                                      : 'TODO'
                                );
                              }}
                            >
                              Move next status
                            </button>

                            {canEdit && (
                              <>
                                <div className="border-t border-border my-1" />
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setOpenMenuTaskId(null);
                                    onEdit(task);
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                  Edit
                                </button>
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-destructive"
                                  onClick={() => {
                                    setOpenMenuTaskId(null);
                                    onDelete(task);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
