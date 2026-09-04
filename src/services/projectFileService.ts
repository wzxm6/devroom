import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import {
  ProjectFile,
  PROJECT_FILES_BUCKET,
  EXTENSION_MIME_MAP,
  MAX_FILES_PER_FOLDER_UPLOAD,
  FolderUploadProgress,
  FolderUploadResult,
} from '@/types/projectFile';
import { Profile } from '@/types/auth';
import { getFileExtension, sanitizeFileName, encodeRelativePath, validateFile } from '@/lib/fileUtils';

// ── Trust boundaries ─────────────────────────────────────────────────────────
// Workspace/project IDs and File objects come from the UI and are used only
// to scope requests and build paths. Enforcement lives server-side:
// database RLS on project_files, Storage RLS on storage.objects, the scope
// trigger, CHECK constraints, and the bucket's 50 MB file_size_limit.
// Browser MIME types and sizes are UX hints, never security signals.

// Storage layout (owned exclusively by this service — never client input):
//   <workspace_id>/<project_id>/<file_id>/<sanitized_name>
// The file id binds the object to its metadata row and prevents collisions.

const SIGNED_URL_TTL_SECONDS = 60;

const FILE_SELECT = `
  id,
  project_id,
  workspace_id,
  uploaded_by,
  storage_path,
  original_name,
  mime_type,
  size_bytes,
  created_at,
  updated_at,
  uploader:profiles!project_files_uploaded_by_fkey(id, username, display_name, avatar_url, created_at, updated_at)
`;

function mapRow(row: Record<string, unknown>): ProjectFile {
  const uploaderRaw = row.uploader;
  const uploader: Profile | undefined = uploaderRaw
    ? (Array.isArray(uploaderRaw) ? (uploaderRaw[0] as Profile) : (uploaderRaw as Profile))
    : undefined;

  return {
    id: row.id as string,
    project_id: row.project_id as string,
    workspace_id: row.workspace_id as string,
    uploaded_by: row.uploaded_by as string,
    storage_path: row.storage_path as string,
    original_name: row.original_name as string,
    mime_type: (row.mime_type as string | null) ?? null,
    size_bytes: row.size_bytes as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    uploader,
  };
}

function resolveMimeType(file: File): string | null {
  if (file.type) return file.type;
  const ext = getFileExtension(file.name);
  return (ext && EXTENSION_MIME_MAP[ext]) || null;
}

// Shared single-object upload used by both single-file and folder flows.
// storageName is the final (already sanitized/encoded) path segment;
// displayName is the base filename shown in the UI and downloads.
async function uploadSingle(
  workspaceId: string,
  projectId: string,
  userId: string,
  file: File,
  storageName: string,
  displayName: string
): Promise<ProjectFile> {
  const fileId = crypto.randomUUID();
  const storagePath = `${workspaceId}/${projectId}/${fileId}/${storageName}`;
  const mimeType = resolveMimeType(file);

  try {
    const { error: uploadError } = await supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(storagePath, file, {
        contentType: mimeType ?? undefined,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file object:', uploadError);
      throw new Error('Failed to upload file. Please check your permissions.');
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('An unexpected error occurred while uploading the file.');
  }

  try {
    const { data, error } = await supabase
      .from('project_files')
      .insert({
        id: fileId,
        project_id: projectId,
        workspace_id: workspaceId,
        uploaded_by: userId,
        storage_path: storagePath,
        original_name: displayName,
        mime_type: mimeType,
        size_bytes: file.size,
      })
      .select(FILE_SELECT)
      .single();

    if (error) {
      console.error('Error creating file metadata:', error);
      // Best-effort orphan cleanup: the object uploaded but the row failed.
      try {
        await supabase.storage.from(PROJECT_FILES_BUCKET).remove([storagePath]);
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned file object:', cleanupErr);
      }
      throw new Error('Failed to save file metadata. The upload was rolled back.');
    }

    return mapRow(data as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('An unexpected error occurred while saving file metadata.');
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export const projectFileService = {
  /**
   * List a project's files, newest first.
   */
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    if (!supabaseConfig.isConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('project_files')
        .select(FILE_SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        // Safety bound, not pagination.
        .limit(200);

      if (error) {
        console.error('Error fetching project files:', error);
        throw new Error('Unable to load project files.');
      }

      return (data || []).map((row) => mapRow(row as unknown as Record<string, unknown>));
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while loading project files.');
    }
  },

  /**
   * Upload sequence (best-effort transaction across Storage + Postgres):
   *   1. validate for UX
   *   2. generate file id + deterministic storage path
   *   3. upload the object
   *   4. insert the metadata row (id bound to the path)
   *   5. if the insert fails, remove the orphaned object and report failure
   */
  async uploadProjectFile(
    workspaceId: string,
    projectId: string,
    userId: string,
    file: File
  ): Promise<ProjectFile> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const validationError = validateFile(file);
    if (validationError) throw new Error(validationError);

    return uploadSingle(workspaceId, projectId, userId, file, sanitizeFileName(file.name), file.name.trim());
  },

  /**
   * Folder upload: same per-file sequence as single upload, run sequentially
   * so large folders stay gentle on the network and progress stays truthful.
   * displayName is the base filename (existing list/download behavior);
   * folder structure travels inside the encoded storage name. A file that
   * fails validation or upload is collected into `failed` — never silently
   * dropped — while the rest continue. Only throws when nothing could run
   * at all (unconfigured client, empty selection, over the batch cap).
   */
  async uploadProjectFolder(
    workspaceId: string,
    projectId: string,
    userId: string,
    files: File[],
    onProgress?: (progress: FolderUploadProgress) => void
  ): Promise<FolderUploadResult> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }
    if (files.length === 0) throw new Error('No files selected.');
    if (files.length > MAX_FILES_PER_FOLDER_UPLOAD) {
      throw new Error(`Folder upload is limited to ${MAX_FILES_PER_FOLDER_UPLOAD} files at a time.`);
    }

    const uploaded: ProjectFile[] = [];
    const failed: FolderUploadResult['failed'] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || file.name;
      try {
        const encoded = encodeRelativePath(relativePath);
        if (!encoded) throw new Error('Could not determine a safe folder location.');
        const validationError = validateFile(file);
        if (validationError) throw new Error(validationError);
        uploaded.push(await uploadSingle(workspaceId, projectId, userId, file, encoded, file.name.trim()));
      } catch (err) {
        failed.push({
          name: relativePath,
          error: err instanceof Error ? err.message : 'Upload failed.',
        });
      }
      onProgress?.({ done: i + 1, total: files.length, currentName: relativePath });
    }

    return { uploaded, failed };
  },

  /**
   * Short-lived signed URL for an authorized download. The bucket is private:
   * no public URLs are ever created. Storage SELECT policy re-authorizes the
   * request server-side, so a guessed path from another workspace is denied.
   */
  async getSignedDownloadUrl(record: ProjectFile): Promise<string> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    try {
      const { data, error } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .createSignedUrl(record.storage_path, SIGNED_URL_TTL_SECONDS);

      if (error || !data?.signedUrl) {
        console.error('Error creating signed download URL:', error);
        throw new Error('Failed to prepare download. You may not have access to this file.');
      }

      return data.signedUrl;
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while preparing the download.');
    }
  },

  /**
   * Delete sequence: Storage object first, then the metadata row.
   * - Storage failure: nothing else changes; the error is surfaced.
   * - Metadata failure after a successful object delete: the error names the
   *   inconsistency (the file list refresh will no longer show the file, and
   *   the object is already gone, so no orphaned bytes remain — only a
   *   possible ghost row, which a refresh/retry resolves).
   * Success is reported only when both sides succeed.
   */
  async deleteProjectFile(record: ProjectFile): Promise<void> {
    if (!supabaseConfig.isConfigured) {
      throw new Error('Supabase is not configured.');
    }

    try {
      const { error: storageError } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .remove([record.storage_path]);

      if (storageError) {
        console.error('Error deleting file object:', storageError);
        throw new Error('Failed to delete file. Please check your permissions.');
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while deleting the file.');
    }

    try {
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('id', record.id);

      if (error) {
        console.error('Error deleting file metadata:', error);
        throw new Error(
          'File object deleted but its record could not be removed. Refresh and retry if it still appears.'
        );
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while deleting file metadata.');
    }
  },
};
