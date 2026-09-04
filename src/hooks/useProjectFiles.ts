import { useState, useEffect, useCallback } from 'react';
import { ProjectFile, FolderUploadProgress, FolderUploadResult } from '@/types/projectFile';
import { projectFileService } from '@/services/projectFileService';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';

// No realtime subscription in this phase: file lists refresh explicitly.
// (project_files is in the realtime publication for future use.)

export const useProjectFiles = (projectId: string | undefined) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingError, setOperatingError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const loadFiles = useCallback(async () => {
    if (!projectId) {
      setFiles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await projectFileService.getProjectFiles(projectId);
      setFiles(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load project files.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const uploadFile = async (file: File): Promise<void> => {
    if (!projectId) throw new Error('Project is required to upload a file.');
    if (!currentWorkspace) throw new Error('Workspace is required to upload a file.');
    if (!user) throw new Error('You must be signed in to upload a file.');

    setOperatingError(null);
    setUploading(true);

    try {
      const created = await projectFileService.uploadProjectFile(
        currentWorkspace.id,
        projectId,
        user.id,
        file
      );
      setFiles((prev) => {
        if (prev.some((f) => f.id === created.id)) return prev;
        return [created, ...prev];
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload file.';
      setOperatingError(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
    }
  };

  const uploadFolder = async (
    files: File[],
    onProgress: (progress: FolderUploadProgress) => void
  ): Promise<FolderUploadResult> => {
    if (!projectId) throw new Error('Project is required to upload a folder.');
    if (!currentWorkspace) throw new Error('Workspace is required to upload a folder.');
    if (!user) throw new Error('You must be signed in to upload a folder.');

    setOperatingError(null);
    setUploading(true);

    try {
      const result = await projectFileService.uploadProjectFolder(
        currentWorkspace.id,
        projectId,
        user.id,
        files,
        onProgress
      );
      if (result.uploaded.length > 0) {
        setFiles((prev) => {
          const known = new Set(prev.map((f) => f.id));
          const fresh = result.uploaded.filter((f) => !known.has(f.id));
          return [...fresh, ...prev];
        });
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload folder.';
      setOperatingError(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (record: ProjectFile): Promise<void> => {
    const original = [...files];
    setOperatingError(null);
    // Optimistic removal with rollback on failure
    setFiles((prev) => prev.filter((f) => f.id !== record.id));

    try {
      await projectFileService.deleteProjectFile(record);
    } catch (err) {
      setFiles(original);
      const msg = err instanceof Error ? err.message : 'Failed to delete file.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  const getDownloadUrl = async (record: ProjectFile): Promise<string> => {
    try {
      return await projectFileService.getSignedDownloadUrl(record);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to prepare download.';
      setOperatingError(msg);
      throw new Error(msg);
    }
  };

  return {
    files,
    loading,
    error,
    operatingError,
    uploading,
    clearOperatingError: () => setOperatingError(null),
    refreshFiles: loadFiles,
    uploadFile,
    uploadFolder,
    deleteFile,
    getDownloadUrl,
  };
};
