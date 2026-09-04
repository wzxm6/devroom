import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import { Post, CreatePostInput, UpdatePostInput } from '@/types/post';

export const postService = {
  async getProjectPosts(projectId: string): Promise<Post[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          project_id,
          author_id,
          title,
          content,
          created_at,
          updated_at,
          author:profiles(id, username, display_name, avatar_url, created_at, updated_at),
          comments:post_comments(count)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        // Safety bound, not pagination: a project should never pull
        // unbounded history into the browser in one request.
        .limit(100);

      if (error) {
        console.error('Error fetching posts:', error);
        throw new Error('Unable to load project posts.');
      }

      return (data || []).map((row) => {
        // Supabase returns count as [{ count: number }]
        const commentCountArr = row.comments as unknown as { count: number }[];
        const count = commentCountArr?.[0]?.count ?? 0;

        return {
          id: row.id,
          project_id: row.project_id,
          author_id: row.author_id,
          title: row.title,
          content: row.content,
          created_at: row.created_at,
          updated_at: row.updated_at,
          author: Array.isArray(row.author) ? row.author[0] : row.author,
          comments_count: count,
        };
      });
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading posts.');
    }
  },

  async getPost(postId: string): Promise<Post | null> {
    if (!supabaseConfig.isConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          project_id,
          author_id,
          title,
          content,
          created_at,
          updated_at,
          author:profiles(id, username, display_name, avatar_url, created_at, updated_at),
          comments:post_comments(count)
        `)
        .eq('id', postId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching post:', error);
        throw new Error('Unable to load post details.');
      }

      if (!data) return null;

      const commentCountArr = data.comments as unknown as { count: number }[];
      const count = commentCountArr?.[0]?.count ?? 0;

      return {
        id: data.id,
        project_id: data.project_id,
        author_id: data.author_id,
        title: data.title,
        content: data.content,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: Array.isArray(data.author) ? data.author[0] : data.author,
        comments_count: count,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while loading post.');
    }
  },

  async createPost(projectId: string, authorId: string, input: CreatePostInput): Promise<Post> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const trimmedTitle = input.title.trim();
    const trimmedContent = input.content.trim();

    if (!trimmedTitle) throw new Error('Post title cannot be empty.');
    if (!trimmedContent) throw new Error('Post content cannot be empty.');

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          project_id: projectId,
          author_id: authorId,
          title: trimmedTitle,
          content: trimmedContent,
        })
        .select(`
          id,
          project_id,
          author_id,
          title,
          content,
          created_at,
          updated_at,
          author:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .single();

      if (error) {
        console.error('Error creating post:', error);
        throw new Error('Failed to create post. Please check permissions.');
      }

      return {
        id: data.id,
        project_id: data.project_id,
        author_id: data.author_id,
        title: data.title,
        content: data.content,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: Array.isArray(data.author) ? data.author[0] : data.author,
        comments_count: 0,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while creating the post.');
    }
  },

  async updatePost(postId: string, input: UpdatePostInput): Promise<Post> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const updates: Partial<{ title: string; content: string }> = {};
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (!t) throw new Error('Post title cannot be empty.');
      updates.title = t;
    }
    if (input.content !== undefined) {
      const c = input.content.trim();
      if (!c) throw new Error('Post content cannot be empty.');
      updates.content = c;
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .select(`
          id,
          project_id,
          author_id,
          title,
          content,
          created_at,
          updated_at,
          author:profiles(id, username, display_name, avatar_url, created_at, updated_at)
        `)
        .single();

      if (error) {
        console.error('Error updating post:', error);
        throw new Error('Failed to update post.');
      }

      return {
        id: data.id,
        project_id: data.project_id,
        author_id: data.author_id,
        title: data.title,
        content: data.content,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: Array.isArray(data.author) ? data.author[0] : data.author,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while updating the post.');
    }
  },

  async deletePost(postId: string): Promise<void> {
    if (!supabaseConfig.isConfigured) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) {
        console.error('Error deleting post:', error);
        throw new Error('Failed to delete post. You must be the author or workspace owner.');
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An error occurred while deleting the post.');
    }
  },
};
