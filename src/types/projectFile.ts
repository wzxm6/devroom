import { Profile } from './auth';

// ── Core Project File ────────────────────────────────────────────────────────
// Mirrors public.project_files. Storage objects live in the private
// `project-files` bucket; this row is the only client-visible record.

export interface ProjectFile {
  id: string;
  project_id: string;
  workspace_id: string;
  uploaded_by: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  uploader?: Profile;
}

// ── Storage ──────────────────────────────────────────────────────────────────

export const PROJECT_FILES_BUCKET = 'project-files';

/** Server-side object cap is also enforced by the bucket (50 MB). */
export const PROJECT_FILE_MAX_SIZE = 50 * 1024 * 1024;

export const PROJECT_FILE_MAX_NAME_LENGTH = 255;

/** Extensions accepted by client-side validation (UX only, not security). */
export const ALLOWED_FILE_EXTENSIONS: readonly string[] = [
  'pdf',
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'zip',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
];

/** Fallback MIME lookup when the browser reports none. Untrusted hint only. */
export const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// ── Folder upload ────────────────────────────────────────────────────────────
// Folder structure is encoded into the 4th storage-path segment so the
// Storage RLS requirement of exactly 4 segments keeps holding with zero
// policy or migration changes.
//
// Encoding MUST stay inside Supabase Storage's key alphabet
// (word chars plus "!-.*'() & $@=;:+,?" — notably NO '~', NO '%', NO
// non-ASCII): anything else fails server-side with InvalidKey. Segments are
// therefore folded to ASCII, stripped to the safe set, joined with '+',
// with literal '+' escaped as '++' so decoding stays unambiguous.

export const FOLDER_SEPARATOR = '+';

/** Safety cap per folder-upload batch (UX only, not security). */
export const MAX_FILES_PER_FOLDER_UPLOAD = 200;

export interface FolderUploadFileFailure {
  /** Display path (relative folder path) of the skipped file. */
  name: string;
  error: string;
}

export interface FolderUploadResult {
  uploaded: ProjectFile[];
  failed: FolderUploadFileFailure[];
}

export interface FolderUploadProgress {
  done: number;
  total: number;
  currentName: string;
}
