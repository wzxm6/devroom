import React, { useState } from 'react';
import { Reply, Edit2, Trash2, Check, X, Clock } from 'lucide-react';
import { CommentTreeNode } from '@/types/post';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CommentComposer } from './CommentComposer';
import { formatTimeAgo } from '@/lib/utils';

interface CommentItemProps {
  comment: CommentTreeNode;
  depth?: number;
  onReply: (parentId: string, content: string) => Promise<void>;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  depth = 0,
  onReply,
  onUpdate,
  onDelete,
}) => {
  const { user } = useAuth();
  const { isOwner } = useWorkspace();

  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAuthor = Boolean(user && comment.author_id === user.id);
  const canDelete = isAuthor || isOwner;
  const isEdited = comment.updated_at !== comment.created_at;

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || loadingEdit) return;

    try {
      setLoadingEdit(true);
      await onUpdate(comment.id, trimmed);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update comment:', err);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(comment.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Limit visual indentation padding to depth 3 to avoid squishing on mobile screens
  const visualIndentation = Math.min(depth, 3);

  return (
    <div
      className={`relative ${
        depth > 0 ? 'mt-3 pl-3 sm:pl-4 border-l-2 border-border/60 ml-2 sm:ml-3' : 'mt-4'
      }`}
    >
      <div className="group rounded-md bg-card/40 hover:bg-card/70 border border-border/40 p-3 transition-colors">
        {/* Comment Header */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              size="xs"
              src={comment.author?.avatar_url}
              name={comment.author?.display_name || 'User'}
            />
            <span className="text-xs font-semibold text-foreground truncate">
              {comment.author?.display_name || 'Collaborator'}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline truncate">
              @{comment.author?.username}
            </span>
            <span className="text-muted-foreground/60 text-xs">·</span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground shrink-0">
              <Clock className="h-2.5 w-2.5" />
              {formatTimeAgo(comment.created_at)}
            </span>
            {isEdited && !comment.is_deleted && (
              <span className="text-[10px] text-muted-foreground/70 font-mono">(edited)</span>
            )}
          </div>

          {/* Action buttons (Reply, Edit, Delete) */}
          {!comment.is_deleted && (
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setIsReplying(!isReplying)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted text-[11px] flex items-center gap-1"
                title="Reply to comment"
              >
                <Reply className="h-3 w-3" />
                <span className="hidden sm:inline">Reply</span>
              </button>

              {isAuthor && !isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setEditContent(comment.content);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted text-[11px] flex items-center gap-1"
                  title="Edit comment"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}

              {canDelete && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 text-[11px]"
                  title="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation mini-banner */}
        {showDeleteConfirm && (
          <div className="my-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
            <span>Delete this comment?</span>
            <div className="flex items-center gap-2">
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

        {/* Comment Content or Edit Mode */}
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
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
                className="h-6 px-2 text-[11px]"
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`text-xs leading-relaxed break-words ${
              comment.is_deleted ? 'italic text-muted-foreground' : 'text-foreground/90'
            }`}
          >
            {comment.content}
          </div>
        )}
      </div>

      {/* Reply Composer */}
      {isReplying && (
        <div className="mt-2 ml-4">
          <CommentComposer
            replyingToName={comment.author?.username || comment.author?.display_name}
            onCancelReply={() => setIsReplying(false)}
            onSubmit={async (content) => {
              await onReply(comment.id, content);
              setIsReplying(false);
            }}
            placeholder={`Reply to @${comment.author?.username || 'user'}...`}
            autoFocus
          />
        </div>
      )}

      {/* Recursive Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={visualIndentation + 1}
              onReply={onReply}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
