import React from 'react';
import { Search, LayoutGrid, List, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TaskPriority, TaskStatus } from '@/types/task';

export interface TaskFilterValues {
  search: string;
  status: TaskStatus | 'ALL';
  priority: TaskPriority | 'ALL';
  assignedToMe: boolean;
  overdue: boolean;
}

interface TaskFiltersBarProps {
  filters: TaskFilterValues;
  onChange: (filters: TaskFilterValues) => void;
  viewMode: 'board' | 'list';
  onViewModeChange: (mode: 'board' | 'list') => void;
  onNewTask: () => void;
  canCreate?: boolean;
}

export const TaskFiltersBar: React.FC<TaskFiltersBarProps> = ({
  filters,
  onChange,
  viewMode,
  onViewModeChange,
  onNewTask,
  canCreate = true,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Search input + My Tasks toggle */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              aria-label="Search tasks"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* All / My Tasks button toggle */}
<div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs">
              <button
                onClick={() => onChange({ ...filters, assignedToMe: false })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  !filters.assignedToMe
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Tasks
              </button>
              <button
                onClick={() => onChange({ ...filters, assignedToMe: true })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filters.assignedToMe
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My Tasks
              </button>
            </div>

            {/* Overdue Toggle */}
            <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs">
              <button
                onClick={() => onChange({ ...filters, overdue: false })}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  !filters.overdue
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Hide overdue filter"
              >
                All
              </button>
              <button
                onClick={() => onChange({ ...filters, overdue: true })}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                  filters.overdue
                    ? 'bg-red-500/10 text-red-400 shadow-sm border border-red-500/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Show only overdue tasks"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Overdue
              </button>
            </div>

            {/* Status Dropdown Filter */}
          <select
            value={filters.status}
            aria-label="Filter by status"
            onChange={(e) => onChange({ ...filters, status: e.target.value as TaskStatus | 'ALL' })}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>

          {/* Priority Dropdown Filter */}
          <select
            value={filters.priority}
            aria-label="Filter by priority"
            onChange={(e) => onChange({ ...filters, priority: e.target.value as TaskPriority | 'ALL' })}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        {/* Right: Board/List toggle + New Task Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => onViewModeChange('board')}
              title="Kanban Board View"
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'board'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              title="Table List View"
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {canCreate && (
            <Button size="sm" onClick={onNewTask} className="text-xs h-8">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Task
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
