import { Profile } from './auth';

// ── Core Chat Message ────────────────────────────────────────────────────────
// Mirrors public.chat_messages. Global workspace messages have
// project_id === null; project-scoped discussion messages carry a project_id.

export interface ChatMessage {
  id: string;
  workspace_id: string;
  project_id: string | null;
  author_id: string;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
  /** Client-only flag for optimistically sent messages awaiting persistence. */
  pending?: boolean;
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface CreateChatMessageInput {
  content: string;
}

export interface UpdateChatMessageInput {
  content: string;
}

// ── Scope ────────────────────────────────────────────────────────────────────

export interface ChatScope {
  workspaceId: string;
  /** Null for global workspace chat, set for project discussion. */
  projectId: string | null;
}

// ── Constraints (mirror the database CHECK; UX validation only) ─────────────

export const CHAT_MAX_LENGTH = 2000;

export const DELETED_MESSAGE_PLACEHOLDER = '[Message deleted]';
