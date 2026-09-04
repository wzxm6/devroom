import React, { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Code,
  Heading2,
  List,
  Quote,
  AtSign,
  Eye,
  Edit3,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write in Markdown...',
  minRows = 6,
  className,
}) => {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { members } = useWorkspace();

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const replacement = `${before}${selected || 'text'}${after}`;

    const updated = value.substring(0, start) + replacement + value.substring(end);
    onChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + (selected.length || 4));
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@') {
      setShowMentionMenu(true);
      setMentionFilter('');
    } else if (showMentionMenu && (e.key === 'Escape' || e.key === ' ')) {
      setShowMentionMenu(false);
    }
  };

  const handleInsertMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    // Replace preceding @ if present
    const lastAt = value.lastIndexOf('@', start);
    let updated: string;
    if (lastAt !== -1 && lastAt >= start - 20) {
      updated = value.substring(0, lastAt) + `@${username} ` + value.substring(start);
    } else {
      updated = value.substring(0, start) + `@${username} ` + value.substring(start);
    }

    onChange(updated);
    setShowMentionMenu(false);
    setTimeout(() => textarea.focus(), 0);
  };

  const filteredMembers = members.filter(
    (m) =>
      m.profile?.display_name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
      m.profile?.username.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  return (
    <div className={cn('rounded-md border border-border bg-card overflow-hidden', className)}>
      {/* Editor Header / Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40">
        {/* Write / Preview Tab Switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
              tab === 'write'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
              tab === 'preview'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>

        {/* Formatting Actions Toolbar (Visible in Write Mode) */}
        {tab === 'write' && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => insertText('**', '**')}
              className="p-1 hover:text-foreground hover:bg-muted/80 rounded"
              title="Bold (**text**)"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('*', '*')}
              className="p-1 hover:text-foreground hover:bg-muted/80 rounded"
              title="Italic (*text*)"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('### ')}
              className="p-1 hover:text-foreground hover:bg-muted/80 rounded"
              title="Heading (### text)"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('`', '`')}
              className="p-1 hover:text-foreground hover:bg-muted/80 rounded"
              title="Inline Code (`code`)"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('- ')}
              className="p-1 hover:text-foreground hover:bg-muted/80 rounded"
              title="Bullet List (- item)"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertText('> ')}
              className="p-1 hover:text-foreground hover:bg-muted/80 rounded"
              title="Quote (> quote)"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowMentionMenu(!showMentionMenu)}
              className="p-1 hover:text-foreground hover:bg-muted/80 rounded text-primary"
              title="Mention Member (@name)"
            >
              <AtSign className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Editor Body */}
      <div className="relative">
        {tab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (showMentionMenu) {
                // If user is typing after @, adjust mention filter
                const start = e.target.selectionStart;
                const lastAt = e.target.value.lastIndexOf('@', start);
                if (lastAt !== -1) {
                  setMentionFilter(e.target.value.substring(lastAt + 1, start));
                }
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={minRows}
            className="w-full bg-card px-3.5 py-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-y font-mono leading-relaxed"
          />
        ) : (
          <div className="p-4 min-h-[140px] bg-card/60">
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-xs text-muted-foreground italic">Nothing to preview yet.</p>
            )}
          </div>
        )}

        {/* Mention Dropdown Popup */}
        {showMentionMenu && (
          <div className="absolute left-4 bottom-3 z-30 w-60 rounded-md border border-border bg-popover shadow-xl p-1 animate-in fade-in">
            <div className="px-2 py-1 text-[10px] uppercase font-mono text-muted-foreground">
              Mention Team Member
            </div>
            <div className="max-h-36 overflow-y-auto space-y-0.5">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleInsertMention(m.profile?.username || 'dev')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-xs transition-colors"
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
    </div>
  );
};
