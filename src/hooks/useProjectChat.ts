import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage } from '@/types/chat';
import { chatService } from '@/services/chatService';
import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';

type RawMessageRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  author_id: string;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

const sortByCreatedAt = (messages: ChatMessage[]): ChatMessage[] =>
  [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));

const makeTempId = () =>
  `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useProjectChat = (projectId: string | undefined) => {
  const { user, profile } = useAuth();
  const { members, currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingError, setOperatingError] = useState<string | null>(null);

  // Ref to hold latest members so realtime callbacks do not need to re-subscribe on member updates
  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const loadMessages = useCallback(async () => {
    if (!projectId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await chatService.getProjectMessages(projectId);
      setMessages(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load messages.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription scoped to this project. The server-side filter
  // carries project_id; rows are still checked defensively in the client.
  useEffect(() => {
    if (!projectId || !supabaseConfig.isConfigured) return;

    const channelName = `project-chat-${projectId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as RawMessageRow;
            // Defensive scope check: only this project's messages belong here
            if (newRow.project_id !== projectId) return;

            setMessages((prev) => {
              // Deduplicate: skip if the persisted row already replaced an optimistic one
              if (prev.some((m) => m.id === newRow.id)) return prev;

              const author =
                membersRef.current.find((m) => m.user_id === newRow.author_id)?.profile || undefined;

              return sortByCreatedAt([...prev, { ...newRow, author }]);
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as RawMessageRow;
            if (updatedRow.project_id !== projectId) return;

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== updatedRow.id) return m;
                const author =
                  m.author ||
                  membersRef.current.find((mem) => mem.user_id === updatedRow.author_id)?.profile ||
                  undefined;
                return { ...m, ...updatedRow, author };
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedRow = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== deletedRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Optimistic send with reconciliation + rollback
  const sendMessage = async (content: string): Promise<void> => {
    if (!projectId) throw new Error('Project is required to send a message.');
    if (!currentWorkspace) throw new Error('Workspace is required to send a message.');
    if (!user) throw new Error('You must be signed in to send a message.');

    const trimmed = content.trim();
    if (!trimmed) throw new Error('Message cannot be empty.');

    setOperatingError(null);
    const tempId = makeTempId();
    const workspaceId = currentWorkspace.id;
    const optimistic: ChatMessage = {
      id: tempId,
      workspace_id: workspaceId,
      project_id: projectId,
      author_id: user.id,
      content: trimmed,
      is_edited: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: profile || membersRef.current.find((m) => m.user_id === user.id)?.profile || undefined,
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);

    try {
      const persisted = await chatService.sendProjectMessage(workspaceId, projectId, user.id, {
        content: trimmed,
      });
      // Replace the optimistic row; drop it if realtime already inserted the row
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === persisted.id)) return withoutTemp;
        return sortByCreatedAt([...withoutTemp, persisted]);
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const msg = err instanceof Error ? err.message : 'Failed to send message.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  // Optimistic edit with rollback
  const editMessage = async (messageId: string, content: string): Promise<void> => {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Message cannot be empty.');

    const original = [...messages];
    setOperatingError(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: trimmed, is_edited: true, updated_at: new Date().toISOString() }
          : m
      )
    );

    try {
      const updated = await chatService.editMessage(messageId, { content: trimmed });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
    } catch (err) {
      setMessages(original);
      const msg = err instanceof Error ? err.message : 'Failed to edit message.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  // Optimistic soft-delete with rollback
  const deleteMessage = async (messageId: string): Promise<void> => {
    const original = [...messages];
    setOperatingError(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, is_deleted: true, content: '[Message deleted]' }
          : m
      )
    );

    try {
      const updated = await chatService.deleteMessage(messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
    } catch (err) {
      setMessages(original);
      const msg = err instanceof Error ? err.message : 'Failed to delete message.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  return {
    messages,
    loading,
    error,
    operatingError,
    clearOperatingError: () => setOperatingError(null),
    refreshMessages: loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
  };
};
