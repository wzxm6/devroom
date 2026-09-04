import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { PostComment, CreateCommentInput, CommentTreeNode } from '@/types/post';

export const commentService = {
  async getPostComments(postId: string): Promise<PostComment[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          author_id,
          parent_id,
          content,
          is_deleted,
          attachment_id,
          x_position,
          y_position,
          created_at,
          updated_at,
          author:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .eq('post_id', postId)
        // Newest-first with a high safety bound, then restored to
        // chronological order so reply threading stays intact.
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error fetching comments:', error);
        throw new Error('Unable to load comments.');
      }

      return (data || [])
        .map((row) => ({
          id: row.id,
          post_id: row.post_id,
          author_id: row.author_id,
          parent_id: row.parent_id,
          content: row.content,
          is_deleted: row.is_deleted,
          attachment_id: row.attachment_id,
          x_position: row.x_position,
          y_position: row.y_position,
          created_at: row.created_at,
          updated_at: row.updated_at,
          author: Array.isArray(row.author) ? row.author[0] : row.author,
        }))
        .reverse();
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading comments.');
    }
  },

  async createComment(postId: string, authorId: string, input: CreateCommentInput): Promise<PostComment> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const trimmed = input.content.trim();
    if (!trimmed) throw new Error('Comment cannot be empty.');

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: authorId,
          parent_id: input.parent_id || null,
          content: trimmed,
          is_deleted: false,
        })
        .select(`
          id,
          post_id,
          author_id,
          parent_id,
          content,
          is_deleted,
          attachment_id,
          x_position,
          y_position,
          created_at,
          updated_at,
          author:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .single();

      if (error) {
        console.error('Error adding comment:', error);
        throw new Error('Failed to post comment. Please check your permissions.');
      }

      return {
        id: data.id,
        post_id: data.post_id,
        author_id: data.author_id,
        parent_id: data.parent_id,
        content: data.content,
        is_deleted: data.is_deleted,
        attachment_id: data.attachment_id,
        x_position: data.x_position,
        y_position: data.y_position,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: Array.isArray(data.author) ? data.author[0] : data.author,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while posting comment.');
    }
  },

  async updateComment(commentId: string, content: string): Promise<PostComment> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const trimmed = content.trim();
    if (!trimmed) throw new Error('Comment cannot be empty.');

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .update({
          content: trimmed,
        })
        .eq('id', commentId)
        .select(`
          id,
          post_id,
          author_id,
          parent_id,
          content,
          is_deleted,
          attachment_id,
          x_position,
          y_position,
          created_at,
          updated_at,
          author:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .single();

      if (error) {
        console.error('Error updating comment:', error);
        throw new Error('Failed to update comment.');
      }

      return {
        id: data.id,
        post_id: data.post_id,
        author_id: data.author_id,
        parent_id: data.parent_id,
        content: data.content,
        is_deleted: data.is_deleted,
        attachment_id: data.attachment_id,
        x_position: data.x_position,
        y_position: data.y_position,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: Array.isArray(data.author) ? data.author[0] : data.author,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while updating comment.');
    }
  },

  async deleteComment(commentId: string): Promise<void> {
    if (!supabaseConfig.isConfigured) return;

    try {
      // Check if comment has any replies to preserve thread hierarchy
      const { count, error: countError } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', commentId);

      if (countError) {
        console.error('Error checking comment replies:', countError);
      }

      if (count && count > 0) {
        // Soft delete to keep reply tree intact
        const { error: updateError } = await supabase
          .from('post_comments')
          .update({
            is_deleted: true,
            content: '[Comment deleted]',
          })
          .eq('id', commentId);

        if (updateError) throw updateError;
      } else {
        // Safe hard delete if leaf node
        const { error: deleteError } = await supabase
          .from('post_comments')
          .delete()
          .eq('id', commentId);

        if (deleteError) throw deleteError;
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('Failed to delete comment.');
    }
  },

  buildCommentTree(flatComments: PostComment[]): CommentTreeNode[] {
    const map = new Map<string, CommentTreeNode>();
    const roots: CommentTreeNode[] = [];

    // Initialize map entries with empty replies
    flatComments.forEach((c) => {
      map.set(c.id, { ...c, replies: [] });
    });

    // Build hierarchy
    flatComments.forEach((c) => {
      const node = map.get(c.id);
      if (!node) return;

      if (c.parent_id && map.has(c.parent_id)) {
        const parent = map.get(c.parent_id);
        parent?.replies.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  },
};
