import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { ProjectFile, FolderUploadProgress, FolderUploadFileFailure } from '@/types/projectFile';
import { ProjectFileList } from './ProjectFileList';
import { FileUploadButton } from './FileUploadButton';
import { FolderUploadButton } from './FolderUploadButton';
import { Button } from '@/components/ui/Button';

interface ProjectFilePanelProps {
  files: ProjectFile[];
  loading: boolean;
  error: string | null;
  operatingError: string | null;
  uploading: boolean;
  onDismissOperatingError: () => void;
  onRefresh: () => void;
  onUpload: (file: File) => Promise<void>;
  onUploadFolder: (
    files: File[],
    onProgress: (progress: FolderUploadProgress) => void
  ) => Promise<{ uploaded: ProjectFile[]; failed: FolderUploadFileFailure[] }>;
  onDownload: (file: ProjectFile) => Promise<string>;
  onDelete: (file: ProjectFile) => Promise<void>;
}

// Reusable project file surface: upload control, operation errors,
// and the file list with loading/error/empty states.
export const ProjectFilePanel: React.FC<ProjectFilePanelProps> = ({
  files,
  loading,
  error,
  operatingError,
  uploading,
  onDismissOperatingError,
  onRefresh,
  onUpload,
  onUploadFolder,
  onDownload,
  onDelete,
}) => {
  const [folderProgress, setFolderProgress] = useState<FolderUploadProgress | null>(null);
  const [folderFailures, setFolderFailures] = useState<FolderUploadFileFailure[]>([]);

  const handleFolderSelect = async (files: File[]) => {
    setFolderFailures([]);
    setFolderProgress({ done: 0, total: files.length, currentName: '' });
    try {
      const result = await onUploadFolder(files, (progress) => setFolderProgress(progress));
      setFolderFailures(result.failed);
    } catch {
      // The hook surfaces operation errors via its error banner
    } finally {
      setFolderProgress(null);
    }
  };
  const handleDownload = async (file: ProjectFile) => {
    const url = await onDownload(file);
    // Trigger a download through a short-lived signed URL. The anchor is
    // never rendered with a permanent or public URL.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.original_name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {files.length > 0 && (
            <span className="font-mono">
              {files.length} file{files.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-xs h-8 text-muted-foreground"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <FileUploadButton onSelect={onUpload} uploading={uploading} />
          <FolderUploadButton onSelect={handleFolderSelect} uploading={uploading} />
        </div>
      </div>

      {folderProgress && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            <span className="font-medium">
              Uploading {folderProgress.done} of {folderProgress.total}
            </span>
            {folderProgress.currentName && (
              <span className="text-muted-foreground truncate font-mono text-[11px]">
                {folderProgress.currentName}
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={folderProgress.total}
            aria-valuenow={folderProgress.done}
            className="h-1.5 rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${folderProgress.total === 0 ? 0 : Math.round((folderProgress.done / folderProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {folderFailures.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-400">
            {folderFailures.length} file{folderFailures.length === 1 ? '' : 's'} skipped:
          </p>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {folderFailures.map((f) => (
              <li key={f.name} className="text-[11px] text-muted-foreground font-mono truncate" title={`${f.name} — ${f.error}`}>
                {f.name} — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {operatingError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive truncate">{operatingError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissOperatingError}
            className="text-xs text-destructive hover:text-foreground shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <ProjectFileList
        files={files}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
        onDownload={handleDownload}
        onDelete={onDelete}
      />
    </div>
  );
};
