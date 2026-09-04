import React, { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { TaskFull } from '@/types/task';

interface DeleteTaskDialogProps {
  isOpen: boolean;
  task: TaskFull | null;
  onClose: () => void;
  onConfirm: (taskId: string) => Promise<void>;
}

export const DeleteTaskDialog: React.FC<DeleteTaskDialogProps> = ({
  isOpen,
  task,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!task) return;
    try {
      setLoading(true);
      setError(null);
      await onConfirm(task.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Task"
    >
      <div className="space-y-4 pt-2">
        {error && (
          <div className="rounded-md bg-destructive/15 border border-destructive/20 p-2.5 flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-xs text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">This action cannot be undone.</p>
            <p className="text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete the task{' '}
              <strong className="text-foreground">"{task?.title}"</strong>?
              It will be removed immediately for all team members.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Task'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
