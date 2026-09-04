import React from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useWorkspaceChat } from '@/hooks/useWorkspaceChat';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { Button } from '@/components/ui/Button';

export const ChatPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const {
    messages,
    loading,
    error,
    operatingError,
    clearOperatingError,
    refreshMessages,
    sendMessage,
    editMessage,
    deleteMessage,
  } = useWorkspaceChat(currentWorkspace?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Global Team Chat
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time chat for everyone in{' '}
            <strong className="text-foreground">{currentWorkspace?.name || 'this workspace'}</strong>.
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Live
            </span>
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={refreshMessages}
          className="text-xs h-8 text-muted-foreground self-start sm:self-auto"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      <ChatPanel
        messages={messages}
        loading={loading}
        error={error}
        operatingError={operatingError}
        onDismissOperatingError={clearOperatingError}
        onRefresh={refreshMessages}
        onSend={sendMessage}
        onEdit={editMessage}
        onDelete={deleteMessage}
        emptyTitle="No messages yet"
        emptyDescription="Start the conversation — say hello, share a status update, or mention a teammate with @."
      />
    </div>
  );
};
