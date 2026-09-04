import { Profile } from './auth';

// ── Status & Priority enums ─────────────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// ── Core Task ────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;   // ISO date string "YYYY-MM-DD"
  created_at: string;
  updated_at: string;
}

// ── Joined variants ──────────────────────────────────────────────────────────

export interface TaskWithAssignee extends Task {
  assignee: Profile | null;
}

export interface TaskWithCreator extends Task {
  creator: Profile | null;
}

export interface TaskFull extends Task {
  assignee: Profile | null;
  creator: Profile | null;
  project?: {
    id: string;
    name: string;
  } | null;
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigned_to?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

// ── Filters ──────────────────────────────────────────────────────────────────

export interface TaskFilters {
  status?: TaskStatus | 'ALL';
  priority?: TaskPriority | 'ALL';
  assignedToMe?: boolean;
  search?: string;
}

// ── Label maps ───────────────────────────────────────────────────────────────

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const ALL_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
export const ALL_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
