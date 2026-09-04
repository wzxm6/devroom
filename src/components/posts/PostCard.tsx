import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ArrowRight, Clock } from 'lucide-react';
import { Post } from '@/types/post';
import { Avatar } from '@/components/ui/Avatar';
import { formatTimeAgo } from '@/lib/utils';

interface PostCardProps {
  post: Post;
  projectId: string;
}

export const PostCard: React.FC<PostCardProps> = ({ post, projectId }) => {
  // Strip markdown formatting for a clean excerpt
  const getExcerpt = (text: string, maxLength: number = 160) => {
    const clean = text
      .replace(/#+\s+/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/>\s+/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength) + '...';
  };

  const isEdited = post.updated_at !== post.created_at;

  return (
    <Link
      to={`/projects/${projectId}/posts/${post.id}`}
      className="group block rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Avatar
            size="xs"
            src={post.author?.avatar_url}
            name={post.author?.display_name || 'Author'}
          />
          <span className="font-medium text-foreground">
            {post.author?.display_name || 'Collaborator'}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(post.created_at)}
          </span>
          {isEdited && (
            <span className="text-[10px] text-muted-foreground font-mono">(edited)</span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4">
        {getExcerpt(post.content)}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-mono text-[11px] bg-muted/40 px-2 py-0.5 rounded border border-border/50 text-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <span>{post.comments_count ?? 0} comments</span>
        </div>

        <span className="inline-flex items-center gap-1 text-primary group-hover:underline font-medium text-xs">
          Open Discussion
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
};
