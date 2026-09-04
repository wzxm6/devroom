import React, { useEffect, useRef } from 'react';
import { MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { ChatMessageItem } from './ChatMessageItem';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  emptyTitle: string;
  emptyDescription: string;
}

const NEAR_BOTTOM_PX = 120;

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  loading,
  error,
  onRefresh,
  onEdit,
  onDelete,
  emptyTitle,
  emptyDescription,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the latest messages in view while reading at the bottom.
  // If the user scrolled up to read history, their position is preserved.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-border/40 bg-card/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-3">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
        <h4 className="text-xs font-semibold text-destructive">{error}</h4>
        <Button variant="outline" size="sm" onClick={onRefresh} className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={MessageSquare}
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 min-h-0">
      {messages.map((message) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
