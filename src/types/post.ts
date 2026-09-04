import { Profile } from './auth';

export type PostAuthor = Profile;

export interface Post {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: PostAuthor;
  comments_count?: number;
}

export type PostWithAuthor = Post & {
  author: PostAuthor;
};

export interface CreatePostInput {
  title: string;
  content: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  is_deleted: boolean;
  attachment_id: string | null;
  x_position: number | null;
  y_position: number | null;
  created_at: string;
  updated_at: string;
  author?: PostAuthor;
}

export interface CreateCommentInput {
  content: string;
  parent_id?: string | null;
}

export interface UpdateCommentInput {
  content: string;
}

export interface CommentTreeNode extends PostComment {
  replies: CommentTreeNode[];
}
