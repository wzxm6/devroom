import React, { useMemo } from 'react';
import { FolderArchive, Folder, AlertCircle, RefreshCw } from 'lucide-react';
import { ProjectFile } from '@/types/projectFile';
import { getStoredFolderPath } from '@/lib/fileUtils';
import { ProjectFileItem } from './ProjectFileItem';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface ProjectFileListProps {
  files: ProjectFile[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDownload: (file: ProjectFile) => Promise<void>;
  onDelete: (file: ProjectFile) => Promise<void>;
}

export const ProjectFileList: React.FC<ProjectFileListProps> = ({
  files,
  loading,
  error,
  onRefresh,
  onDownload,
  onDelete,
}) => {
  // Group folder-uploaded files by their encoded folder path so the
  // original structure is visible. Legacy flat files render ungrouped.
  // (Above all early returns: hooks must run in the same order every render.)
  const { rootFiles, folderGroups } = useMemo(() => {
    const root: ProjectFile[] = [];
    const groups = new Map<string, ProjectFile[]>();
    for (const file of files) {
      const folders = getStoredFolderPath(file.storage_path);
      if (folders.length === 0) {
        root.push(file);
      } else {
        const key = folders.join(' / ');
        const list = groups.get(key);
        if (list) list.push(file);
        else groups.set(key, [file]);
      }
    }
    return { rootFiles: root, folderGroups: [...groups.entries()] };
  }, [files]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-md border border-border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
        <h4 className="text-xs font-semibold text-destructive">{error}</h4>
        <Button variant="outline" size="sm" onClick={onRefresh} className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <EmptyState
        icon={FolderArchive}
        title="No files yet"
        description="Upload design docs, specs, screenshots, or archives to share them privately with your project team."
      />
    );
  }

  return (
    <div className="space-y-4">
      {rootFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rootFiles.map((file) => (
            <ProjectFileItem
              key={file.id}
              file={file}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      {folderGroups.map(([folder, groupFiles]) => (
        <div key={folder} className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground px-0.5">
            <Folder className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span className="truncate font-mono text-[11px]">{folder}</span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {groupFiles.length} file{groupFiles.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-3 sm:pl-5 border-l-2 border-border/60 ml-1">
            {groupFiles.map((file) => (
              <ProjectFileItem
                key={file.id}
                file={file}
                onDownload={onDownload}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
