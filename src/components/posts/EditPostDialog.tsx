import React, { useState, useEffect } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MarkdownEditor } from './MarkdownEditor';
import { Post, UpdatePostInput } from '@/types/post';

interface EditPostDialogProps {
  isOpen: boolean;
  post: Post | null;
  onClose: () => void;
  onSubmit: (postId: string, input: UpdatePostInput) => Promise<void>;
}

export const EditPostDialog: React.FC<EditPostDialogProps> = ({
  isOpen,
  post,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setError(null);
    }
  }, [post, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setError('Title cannot be empty.');
      return;
    }

    if (!trimmedContent) {
      setError('Content cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit(post.id, {
        title: trimmedTitle,
        content: trimmedContent,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update post.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Post"
      description="Update post title and documentation."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Post Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Markdown Content
          </label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            minRows={8}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={loading}>
            <Save className="h-3.5 w-3.5 mr-1" />
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
