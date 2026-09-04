import React, { useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MarkdownEditor } from './MarkdownEditor';
import { CreatePostInput } from '@/types/post';

interface CreatePostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreatePostInput) => Promise<void>;
}

export const CreatePostDialog: React.FC<CreatePostDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setContent('');
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    if (trimmedTitle.length > 120) {
      setError('Title must be 120 characters or fewer.');
      return;
    }

    if (!trimmedContent) {
      setError('Post content cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        title: trimmedTitle,
        content: trimmedContent,
      });
      reset();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish post.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Project Post"
      description="Publish an architectural note, RFC, progress update, or technical decision."
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
          placeholder="e.g. New translation pipeline architecture, Version 1.2 RFC"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          autoFocus
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Markdown Content
          </label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Document the updates, code blocks, or decisions in Markdown..."
            minRows={8}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={loading}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Publish Post
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
