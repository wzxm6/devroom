import React, { useState } from 'react';
import { Edit2, Trash2, Check, X, Clock } from 'lucide-react';
import { ChatMessage, CHAT_MAX_LENGTH } from '@/types/chat';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ChatMessageContent } from './ChatMessageContent';
import { formatTimeAgo } from '@/lib/utils';

interface ChatMessageItemProps {
  message: ChatMessage;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const { isOwner } = useWorkspace();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAuthor = Boolean(user && message.author_id === user.id);
  const canDelete = isAuthor || isOwner;

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed.length > CHAT_MAX_LENGTH || loadingEdit) return;

    try {
      setLoadingEdit(true);
      await onEdit(message.id, trimmed);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to edit message:', err);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(message.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  return (
    <div className="group rounded-md bg-card/40 hover:bg-card/70 border border-border/40 p-3 transition-colors">
      {/* Message Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            size="xs"
            src={message.author?.avatar_url}
            name={message.author?.display_name || 'User'}
          />
          <span className="text-xs font-semibold text-foreground truncate">
            {message.author?.display_name || 'Collaborator'}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline truncate">
            @{message.author?.username}
          </span>
          <span className="text-muted-foreground/60 text-xs">·</span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {formatTimeAgo(message.created_at)}
          </span>
          {message.is_edited && !message.is_deleted && (
            <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0">(edited)</span>
          )}
          {message.pending && (
            <span className="text-[10px] text-amber-400/90 font-mono shrink-0">Sending…</span>
          )}
        </div>

        {/* Action buttons (Edit own, Delete own/owner-moderated) */}
        {!message.is_deleted && !message.pending && (
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
            {isAuthor && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(message.content);
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted text-[11px] flex items-center gap-1"
                title="Edit message"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}

            {canDelete && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 text-[11px]"
                title="Delete message"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation mini-banner */}
      {showDeleteConfirm && (
        <div className="my-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between gap-2">
          <span>Delete this message?</span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="h-6 px-2 text-[11px]"
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              className="h-6 px-2 text-[11px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Message Content or Edit Mode */}
      {isEditing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={2}
            maxLength={CHAT_MAX_LENGTH}
            className="w-full rounded border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              className="h-6 px-2 text-[11px]"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              isLoading={loadingEdit}
              disabled={!editContent.trim()}
              className="h-6 px-2 text-[11px]"
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`text-xs leading-relaxed break-words whitespace-pre-wrap ${
            message.is_deleted ? 'italic text-muted-foreground' : 'text-foreground/90'
          }`}
        >
          {message.is_deleted ? (
            'Message deleted'
          ) : (
            <ChatMessageContent content={message.content} />
          )}
        </div>
      )}
    </div>
  );
};
