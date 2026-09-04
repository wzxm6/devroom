import React, { useState } from 'react';
import {
  File,
  FileText,
  FileImage,
  FileArchive,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { ProjectFile } from '@/types/projectFile';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { formatFileSize, getFileExtension } from '@/lib/fileUtils';
import { formatDate } from '@/lib/utils';

interface ProjectFileItemProps {
  file: ProjectFile;
  onDownload: (file: ProjectFile) => Promise<void>;
  onDelete: (file: ProjectFile) => Promise<void>;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'json'];

const FileTypeIcon: React.FC<{ extension: string }> = ({ extension }) => {
  const className = 'h-4 w-4 shrink-0 text-primary';
  if (IMAGE_EXTENSIONS.includes(extension)) return <FileImage className={className} />;
  if (TEXT_EXTENSIONS.includes(extension)) return <FileText className={className} />;
  if (extension === 'zip') return <FileArchive className={className} />;
  return <File className={className} />;
};

export const ProjectFileItem: React.FC<ProjectFileItemProps> = ({
  file,
  onDownload,
  onDelete,
}) => {
  const { user } = useAuth();
  const { isOwner } = useWorkspace();

  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isUploader = Boolean(user && file.uploaded_by === user.id);
  const canDelete = isUploader || isOwner;
  const extension = getFileExtension(file.original_name);

  const handleDownload = async () => {
    if (downloading) return;
    try {
      setDownloading(true);
      await onDownload(file);
    } catch (err) {
      console.error('Failed to download file:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    try {
      setDeleting(true);
      await onDelete(file);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete file:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="mt-0.5">
            <FileTypeIcon extension={extension} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground truncate" title={file.original_name}>
              {file.original_name}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
              {formatFileSize(file.size_bytes)}
              {extension && <span className="uppercase"> · {extension}</span>}
              <span> · {formatDate(file.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Avatar
                size="xs"
                src={file.uploader?.avatar_url}
                name={file.uploader?.display_name || 'User'}
              />
              <span className="text-[10px] text-muted-foreground truncate">
                {file.uploader?.display_name || 'Collaborator'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Download file"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </button>

          {canDelete && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete file"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between gap-2">
          <span className="truncate">Delete this file permanently?</span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="h-6 px-2 text-[11px]"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="h-6 px-2 text-[11px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
