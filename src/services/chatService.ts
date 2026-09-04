import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import {
  ChatMessage,
  CreateChatMessageInput,
  UpdateChatMessageInput,
  CHAT_MAX_LENGTH,
  DELETED_MESSAGE_PLACEHOLDER,
} from '@/types/chat';
import { Profile } from '@/types/auth';

// ── Internal query helper ────────────────────────────────────────────────────
// NOTE on trust boundaries: workspace/project IDs passed in here come from
// route params and workspace context (UI-controlled values). They are used
// only to scope queries for UX. Row Level Security on chat_messages is the
// final authorization boundary — it rejects cross-workspace access,
// author_id spoofing, and project/workspace mismatches at the database level.

const CHAT_SELECT = `
  id,
  workspace_id,
  project_id,
  author_id,
  content,
  is_edited,
  is_deleted,
  created_at,
  updated_at,
  author:profiles(id, username, display_name, avatar_url, created_at, updated_at)
`;

function mapRow(row: Record<string, unknown>): ChatMessage {
  const authorRaw = row.author;
  const author: Profile | undefined = authorRaw
    ? (Array.isArray(authorRaw) ? (authorRaw[0] as Profile) : (authorRaw as Profile))
    : undefined;

  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    project_id: (row.project_id as string | null) ?? null,
    author_id: row.author_id as string,
    content: row.content as string,
    is_edited: row.is_edited as boolean,
    is_deleted: row.is_deleted as boolean,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    author,
  };
}

function validateContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > CHAT_MAX_LENGTH) {
    throw new Error(`Message cannot exceed ${CHAT_MAX_LENGTH} characters.`);
  }
  return trimmed;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const chatService = {
  /**
   * List global workspace messages (project_id IS NULL), oldest first.
   * Safety bound keeps the newest window; order is restored client-side.
   */
  async getWorkspaceMessages(workspaceId: string): Promise<ChatMessage[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(CHAT_SELECT)
        .eq('workspace_id', workspaceId)
        .is('project_id', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching workspace messages:', error);
        throw new Error('Unable to load messages.');
      }

      return (data || [])
        .map((row) => mapRow(row as unknown as Record<string, unknown>))
        .reverse();
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading messages.');
    }
  },

  /**
   * List project-scoped discussion messages, oldest first.
   * Safety bound keeps the newest window; order is restored client-side.
   */
  async getProjectMessages(projectId: string): Promise<ChatMessage[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(CHAT_SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching project messages:', error);
        throw new Error('Unable to load messages.');
      }

      return (data || [])
        .map((row) => mapRow(row as unknown as Record<string, unknown>))
        .reverse();
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading messages.');
    }
  },

  /**
   * Send a global workspace message as the current user.
   */
  async sendWorkspaceMessage(
    workspaceId: string,
    authorId: string,
    input: CreateChatMessageInput
  ): Promise<ChatMessage> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const content = validateContent(input.content);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          workspace_id: workspaceId,
          project_id: null,
          author_id: authorId,
          content,
        })
        .select(CHAT_SELECT)
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message. Please check your permissions.');
      }

      return mapRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while sending the message.');
    }
  },

  /**
   * Send a project-scoped discussion message as the current user.
   */
  async sendProjectMessage(
    workspaceId: string,
    projectId: string,
    authorId: string,
    input: CreateChatMessageInput
  ): Promise<ChatMessage> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const content = validateContent(input.content);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          author_id: authorId,
          content,
        })
        .select(CHAT_SELECT)
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message. Please check your permissions.');
      }

      return mapRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while sending the message.');
    }
  },

  /**
   * Edit your own message. RLS guarantees authorship; owners cannot edit
   * other users' messages.
   */
  async editMessage(messageId: string, input: UpdateChatMessageInput): Promise<ChatMessage> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const content = validateContent(input.content);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .update({
          content,
          is_edited: true,
        })
        .eq('id', messageId)
        .select(CHAT_SELECT)
        .single();

      if (error) {
        console.error('Error editing message:', error);
        throw new Error('Failed to edit message.');
      }

      return mapRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while editing the message.');
    }
  },

  /**
   * Soft-delete a message (sets is_deleted, preserves the row), following the
   * post_comments convention. Authors may remove their own messages;
   * workspace owners may moderate via the same call (enforced by RLS).
   */
  async deleteMessage(messageId: string): Promise<ChatMessage> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .update({
          is_deleted: true,
          content: DELETED_MESSAGE_PLACEHOLDER,
        })
        .eq('id', messageId)
        .select(CHAT_SELECT)
        .single();

      if (error) {
        console.error('Error deleting message:', error);
        throw new Error('Failed to delete message.');
      }

      return mapRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while deleting the message.');
    }
  },
};
