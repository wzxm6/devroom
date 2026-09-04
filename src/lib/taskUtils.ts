import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { TaskPriority, TaskStatus } from '@/types/task';

// ── Due date helpers ─────────────────────────────────────────────────────────

export interface DueDateInfo {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
}

export function getDueDateInfo(dueDateStr: string | null): DueDateInfo | null {
  if (!dueDateStr) return null;
  const date = parseISO(dueDateStr);
  if (!isValid(date)) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(date, today);

  if (diff < 0) {
    const days = Math.abs(diff);
    return {
      label: `Overdue by ${days} day${days === 1 ? '' : 's'}`,
      isOverdue: true,
      isToday: false,
      isTomorrow: false,
    };
  }
  if (diff === 0) {
    return { label: 'Due today', isOverdue: false, isToday: true, isTomorrow: false };
  }
  if (diff === 1) {
    return { label: 'Due tomorrow', isOverdue: false, isToday: false, isTomorrow: true };
  }
  return {
    label: `Due in ${diff} days`,
    isOverdue: false,
    isToday: false,
    isTomorrow: false,
  };
}

// ── Priority config ──────────────────────────────────────────────────────────

export interface PriorityConfig {
  label: string;
  icon: string;          // emoji — accessible fallback is the label
  className: string;     // Tailwind classes
}

export const PRIORITY_CONFIG: Record<TaskPriority, PriorityConfig> = {
  LOW: {
    label: 'Low',
    icon: '▽',
    className: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  },
  MEDIUM: {
    label: 'Medium',
    icon: '◈',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  HIGH: {
    label: 'High',
    icon: '▲',
    className: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  URGENT: {
    label: 'Urgent',
    icon: '‼',
    className: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
};

// ── Status config ────────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  className: string;
}

export const STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  TODO: {
    label: 'To Do',
    className: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  DONE: {
    label: 'Done',
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
};
