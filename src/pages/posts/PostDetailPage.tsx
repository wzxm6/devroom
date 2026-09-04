import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Post, PostComment, UpdatePostInput } from '@/types/post';
import { postService } from '@/services/postService';
import { commentService } from '@/services/commentService';
import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { MarkdownRenderer } from '@/components/posts/MarkdownRenderer';
import { EditPostDialog } from '@/components/posts/EditPostDialog';
import { CommentComposer } from '@/components/posts/CommentComposer';
import { CommentItem } from '@/components/posts/CommentItem';
import { formatDate, formatTimeAgo } from '@/lib/utils';

export const PostDetailPage: React.FC = () => {
  const { projectId, postId } = useParams<{ projectId: string; postId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isOwner, members } = useWorkspace();
  const { toastError } = useToast();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Load post and initial comments
  const loadData = useCallback(async () => {
    if (!postId) return;
    try {
      setLoading(true);
      setError(null);
      const [postData, commentsData] = await Promise.all([
        postService.getPost(postId),
        commentService.getPostComments(postId),
      ]);

      if (!postData) {
        setError('Post not found or you do not have permission to view it.');
      } else {
        setPost(postData);
        setComments(commentsData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load post.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Supabase Subscription for post comments
  useEffect(() => {
    if (!postId || !supabaseConfig.isConfigured) return;

    const channelName = `realtime-post-comments-${postId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as PostComment;
            // Prevent duplicate insertion if optimistic UI already replaced it
            setComments((prev) => {
              if (prev.some((c) => c.id === newRow.id)) return prev;

              // Find author profile from workspace members list
              const authorProfile =
                members.find((m) => m.user_id === newRow.author_id)?.profile ||
                (user && newRow.author_id === user.id ? profile || undefined : undefined);

              const commentWithAuthor: PostComment = {
                ...newRow,
                author: authorProfile,
              };

              return [...prev, commentWithAuthor];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as PostComment;
            setComments((prev) =>
              prev.map((c) => (c.id === updatedRow.id ? { ...c, ...updatedRow } : c))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedRow = payload.old as { id: string };
            setComments((prev) => prev.filter((c) => c.id !== deletedRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, members, user, profile]);

  const handleUpdatePost = async (id: string, input: UpdatePostInput) => {
    const updated = await postService.updatePost(id, input);
    setPost(updated);
  };

  const handleDeletePost = async () => {
    if (!post) return;
    try {
      setIsDeleting(true);
      await postService.deletePost(post.id);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      logger.error('Failed to delete post', { error: err instanceof Error ? err.message : 'unknown' });
      toastError('Could not delete the post. Please try again.');
      setIsDeleting(false);
    }
  };

  // Add root comment with optimistic update
  const handleAddRootComment = async (content: string) => {
    if (!postId || !user) return;

    const tempId = `optimistic-${Date.now()}`;
    const optimisticComment: PostComment = {
      id: tempId,
      post_id: postId,
      author_id: user.id,
      parent_id: null,
      content,
      is_deleted: false,
      attachment_id: null,
      x_position: null,
      y_position: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: profile || undefined,
    };

    // Optimistically add to state
    setComments((prev) => [...prev, optimisticComment]);

    try {
      const realComment = await commentService.createComment(postId, user.id, { content });
      // Replace optimistic comment with real DB record
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? realComment : c))
      );
    } catch (err) {
      // Revert on failure
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      throw err;
    }
  };

  // Reply to comment with optimistic update
  const handleReplyComment = async (parentId: string, content: string) => {
    if (!postId || !user) return;

    const tempId = `optimistic-${Date.now()}`;
    const optimisticReply: PostComment = {
      id: tempId,
      post_id: postId,
      author_id: user.id,
      parent_id: parentId,
      content,
      is_deleted: false,
      attachment_id: null,
      x_position: null,
      y_position: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: profile || undefined,
    };

    setComments((prev) => [...prev, optimisticReply]);

    try {
      const realReply = await commentService.createComment(postId, user.id, {
        content,
        parent_id: parentId,
      });
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? realReply : c))
      );
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      throw err;
    }
  };

  // Edit comment
  const handleUpdateComment = async (commentId: string, content: string) => {
    const updated = await commentService.updateComment(commentId, content);
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    await commentService.deleteComment(commentId);
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, is_deleted: true, content: '[Comment deleted]' } : c
      )
    );
  };

  // Build hierarchical comment tree
  const commentTree = useMemo(() => {
    return commentService.buildCommentTree(comments);
  }, [comments]);

  const isAuthor = Boolean(user && post && post.author_id === user.id);
  const canManagePost = isAuthor || isOwner;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-40 w-full" />
        <div className="space-y-3 pt-6 border-t border-border">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-8 text-center space-y-4">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
        <h2 className="text-base font-semibold text-destructive">{error || 'Post not found'}</h2>
        <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Project
        </Button>
      </div>
    );
  }

  const isPostEdited = post.updated_at !== post.created_at;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back to Project navigation */}
      <div>
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Project
        </Link>
      </div>

      {/* Main Post Card */}
      <Card>
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {post.title}
              </CardTitle>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar
                    size="sm"
                    src={post.author?.avatar_url}
                    name={post.author?.display_name || 'Author'}
                  />
                  <div>
                    <span className="font-semibold text-foreground">
                      {post.author?.display_name || 'Collaborator'}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">
                      @{post.author?.username}
                    </span>
                  </div>
                </div>

                <span>·</span>

                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(post.created_at)}</span>
                </div>

                {isPostEdited && (
                  <>
                    <span>·</span>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>edited {formatTimeAgo(post.updated_at)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Author / Owner Actions */}
            {canManagePost && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                  className="text-xs h-8"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-xs h-8"
                  isLoading={isDeleting}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {deleteConfirm && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
              <span>Permanently delete this post and its discussion?</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeletePost}
                  className="h-7 px-2.5 text-xs"
                >
                  Confirm Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(false)}
                  className="h-7 px-2.5 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-2 border-t border-border/60">
          <MarkdownRenderer content={post.content} className="py-2" />
        </CardContent>
      </Card>

      {/* Discussion & Threaded Comments Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Discussion ({comments.length})
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Live
            </span>
          </h2>
          <Button variant="ghost" size="sm" onClick={loadData} className="text-xs h-7 text-muted-foreground">
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Root Comment Composer */}
        <CommentComposer
          onSubmit={handleAddRootComment}
          placeholder="Add your feedback, answer, or thoughts on this post..."
        />

        {/* Threaded Comments List */}
        {commentTree.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 p-8 text-center bg-card/20">
            <MessageSquare className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-foreground">No comments yet</h4>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-sm mx-auto">
              Be the first to share an insight, suggestion, or question on this post.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {commentTree.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                onReply={handleReplyComment}
                onUpdate={handleUpdateComment}
                onDelete={handleDeleteComment}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Post Dialog */}
      <EditPostDialog
        isOpen={isEditOpen}
        post={post}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdatePost}
      />
    </div>
  );
};
