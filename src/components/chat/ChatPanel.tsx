import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  operatingError: string | null;
  onDismissOperatingError: () => void;
  onRefresh: () => void;
  onSend: (content: string) => Promise<void>;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  emptyTitle: string;
  emptyDescription: string;
  composerPlaceholder?: string;
}

// Reusable chat surface shared by global workspace chat and per-project
// discussion. Layout: scrollable message list with a pinned composer.
export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  loading,
  error,
  operatingError,
  onDismissOperatingError,
  onRefresh,
  onSend,
  onEdit,
  onDelete,
  emptyTitle,
  emptyDescription,
  composerPlaceholder,
}) => {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card/40 min-h-[420px] max-h-[70vh]">
      {operatingError && (
        <div className="m-3 mb-0 rounded-md border border-destructive/20 bg-destructive/10 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive truncate">{operatingError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissOperatingError}
            className="text-xs text-destructive hover:text-foreground shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <ChatMessageList
        messages={messages}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />

      <div className="p-3 pt-2 border-t border-border/60 shrink-0">
        <ChatComposer onSend={onSend} placeholder={composerPlaceholder} />
      </div>
    </div>
  );
};
