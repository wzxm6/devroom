import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskFull, TaskStatus } from '@/types/task';
import { WorkspaceMember } from '@/types/workspace';
import { TaskCard } from './TaskCard';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskBoardProps {
  tasks: TaskFull[];
  members: WorkspaceMember[];
  canManageTask: (task: TaskFull) => boolean;
  onEdit: (task: TaskFull) => void;
  onDelete: (task: TaskFull) => void;
  onView: (task: TaskFull) => void;
  onStatusChange: (task: TaskFull, newStatus: TaskStatus) => void;
  onNewTaskWithStatus?: (status: TaskStatus) => void;
  showProject?: boolean;
}

const COLUMNS: { id: TaskStatus; label: string; dotColor: string }[] = [
  { id: 'TODO', label: 'To Do', dotColor: 'bg-slate-400' },
  { id: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-blue-400' },
  { id: 'DONE', label: 'Done', dotColor: 'bg-emerald-400' },
];

// ── Draggable Item Wrapper ───────────────────────────────────────────────────

interface SortableCardProps {
  task: TaskFull;
  members: WorkspaceMember[];
  canEdit: boolean;
  onEdit: (task: TaskFull) => void;
  onDelete: (task: TaskFull) => void;
  onView: (task: TaskFull) => void;
  onStatusChange: (task: TaskFull, newStatus: TaskStatus) => void;
  showProject?: boolean;
}


const SortableCard: React.FC<SortableCardProps> = ({
  task,
  members,
  canEdit,
  onEdit,
  onDelete,
  onView,
  onStatusChange,
  showProject,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('touch-manipulation', isDragging && 'opacity-40')}
    >
      <TaskCard
        task={task}
        members={members}
        canEdit={canEdit}
        onEdit={onEdit}
        onDelete={onDelete}
        onView={onView}
        onStatusChange={onStatusChange}
        showProject={showProject}
      />
    </div>
  );
};

// ── Droppable Column Wrapper ─────────────────────────────────────────────────

interface ColumnProps {
  status: TaskStatus;
  label: string;
  dotColor: string;
  tasks: TaskFull[];
  members: WorkspaceMember[];
  canManageTask: (task: TaskFull) => boolean;
  onEdit: (task: TaskFull) => void;
  onDelete: (task: TaskFull) => void;
  onView: (task: TaskFull) => void;
  onStatusChange: (task: TaskFull, newStatus: TaskStatus) => void;
  onNewTaskWithStatus?: (status: TaskStatus) => void;
  showProject?: boolean;
}

const KanbanColumn: React.FC<ColumnProps> = ({
  status,
  label,
  dotColor,
  tasks,
  members,
  canManageTask,
  onEdit,
  onDelete,
  onView,
  onStatusChange,
  onNewTaskWithStatus,
  showProject,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border border-border/80 bg-muted/20 p-3 min-w-[280px] flex-1 transition-colors',
        isOver && 'border-primary/50 bg-primary/5'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', dotColor)} />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {label}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {tasks.length}
          </span>
        </div>

        {onNewTaskWithStatus && (
          <button
            onClick={() => onNewTaskWithStatus(status)}
            title={`Add ${label} task`}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Column Task Cards */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[140px]">
          {tasks.length === 0 ? (
            <div className="h-full min-h-[120px] flex items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center">
              <span className="text-xs text-muted-foreground/60 italic">
                No tasks
              </span>
            </div>
          ) : (
            tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                members={members}
                canEdit={canManageTask(task)}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
                onStatusChange={onStatusChange}
                showProject={showProject}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// ── TaskBoard Main Component ─────────────────────────────────────────────────

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  members,
  canManageTask,
  onEdit,
  onDelete,
  onView,
  onStatusChange,
  onNewTaskWithStatus,
  showProject = false,
}) => {

  const [activeTask, setActiveTask] = useState<TaskFull | null>(null);

  // Configure pointer sensor with small distance activation so clicks don't register as drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskData = event.active.data.current?.task as TaskFull | undefined;
    if (taskData) {
      setActiveTask(taskData);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;

    // Check where it was dropped:
    // Case 1: Dropped over a column directly (over.id is 'TODO', 'IN_PROGRESS', 'DONE')
    if (over.id === 'TODO' || over.id === 'IN_PROGRESS' || over.id === 'DONE') {
      const newStatus = over.id as TaskStatus;
      if (task.status !== newStatus) {
        onStatusChange(task, newStatus);
      }
      return;
    }

    // Case 2: Dropped over another task
    const overTaskId = over.id as string;
    const overTask = tasks.find((t) => t.id === overTaskId);
    if (overTask && overTask.status !== task.status) {
      onStatusChange(task, overTask.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.id);
          return (
            <KanbanColumn
              key={col.id}
              status={col.id}
              label={col.label}
              dotColor={col.dotColor}
              tasks={columnTasks}
              members={members}
              canManageTask={canManageTask}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              onStatusChange={onStatusChange}
              onNewTaskWithStatus={onNewTaskWithStatus}
              showProject={showProject}
            />
          );
        })}
      </div>

      {/* Drag Overlay for active card preview */}
      <DragOverlay>
        {activeTask ? (
          <div className="w-[300px] shadow-2xl opacity-95">
            <TaskCard
              task={activeTask}
              members={members}
              canEdit={false}
              onEdit={() => {}}
              onDelete={() => {}}
              onView={() => {}}
              onStatusChange={() => {}}
              isDragging
              showProject={showProject}
            />
          </div>
        ) : null}
      </DragOverlay>

    </DndContext>
  );
};
