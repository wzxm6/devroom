import React, { useState, useRef } from 'react';
import { Send, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Avatar } from '@/components/ui/Avatar';
import { CHAT_MAX_LENGTH } from '@/types/chat';

interface ChatComposerProps {
  onSend: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSend,
  placeholder = 'Write a message... (Enter to send, Shift+Enter for a new line)',
  autoFocus = false,
}) => {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { members } = useWorkspace();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === '@') {
      setShowMentions(true);
      setMentionQuery('');
    } else if (showMentions && (e.key === 'Escape' || e.key === ' ')) {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lastAt = content.lastIndexOf('@', start);
    let updated: string;
    if (lastAt !== -1 && lastAt >= start - 20) {
      updated = content.substring(0, lastAt) + `@${username} ` + content.substring(start);
    } else {
      updated = content.substring(0, start) + `@${username} ` + content.substring(start);
    }

    setContent(updated);
    setShowMentions(false);
    setTimeout(() => textarea.focus(), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    try {
      setSending(true);
      await onSend(trimmed);
      setContent('');
    } catch (err) {
      // The hook surfaces operation errors via its error banner; keep the
      // typed content so the user can retry without retyping.
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.profile?.display_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      m.profile?.username.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const overLimit = content.trim().length > CHAT_MAX_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="relative rounded-lg border border-border bg-card p-3 shadow-sm space-y-2">
      {/* Input Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          aria-label="Write a chat message"
          onChange={(e) => {
            setContent(e.target.value);
            if (showMentions) {
              const start = e.target.selectionStart;
              const lastAt = e.target.value.lastIndexOf('@', start);
              if (lastAt !== -1) {
                setMentionQuery(e.target.value.substring(lastAt + 1, start));
              }
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-none leading-relaxed font-sans"
        />

        {/* Mention Dropdown */}
        {showMentions && (
          <div className="absolute left-0 bottom-full mb-1 z-30 w-56 rounded-md border border-border bg-popover shadow-xl p-1 animate-in fade-in">
            <div className="px-2 py-1 text-[10px] uppercase font-mono text-muted-foreground">
              Mention Teammate
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMention(m.profile?.username || 'dev')}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-left text-xs transition-colors"
                >
                  <Avatar
                    size="xs"
                    src={m.profile?.avatar_url}
                    name={m.profile?.display_name || 'Member'}
                  />
                  <div className="truncate min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {m.profile?.display_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate block">
                      @{m.profile?.username}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowMentions(!showMentions)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted text-xs flex items-center gap-1"
            title="Mention member (@)"
          >
            <AtSign className="h-3.5 w-3.5" />
            <span className="text-[10px]">Mention</span>
          </button>
          {overLimit && (
            <span className="text-[10px] text-destructive font-mono">
              {content.trim().length}/{CHAT_MAX_LENGTH}
            </span>
          )}
        </div>

        <Button
          type="submit"
          size="sm"
          isLoading={sending}
          disabled={!content.trim() || overLimit}
          className="text-xs h-7 px-3"
        >
          <Send className="h-3 w-3 mr-1" />
          Send
        </Button>
      </div>
    </form>
  );
};
