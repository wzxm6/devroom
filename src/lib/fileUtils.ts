import {
  ALLOWED_FILE_EXTENSIONS,
  FOLDER_SEPARATOR,
  PROJECT_FILE_MAX_NAME_LENGTH,
  PROJECT_FILE_MAX_SIZE,
} from '@/types/projectFile';

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function getFileExtension(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return '';
  return trimmed.slice(dot + 1).toLowerCase();
}

// ── Sanitization ─────────────────────────────────────────────────────────────
// Storage path segments must stay inside Supabase's key alphabet (ASCII
// word chars plus "!-.*'() & $@=;:+,?" — no '/', no controls, no traversal,
// no non-ASCII). The file id in the path already guarantees uniqueness;
// the name is display.

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = sanitizePathSegment(base);
  const fallback = cleaned || 'file';
  return fallback.slice(0, PROJECT_FILE_MAX_NAME_LENGTH);
}

// ── Folder-path encoding ─────────────────────────────────────────────────────
// webkitRelativePath looks like "folder/sub/file.txt" on every platform.
// The encoded form must satisfy Supabase Storage key validation
// (/^(\w|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/ per path segment,
// '/' reserved as the real delimiter), so segments are folded to ASCII,
// stripped to that alphabet, and joined with '+' (literal '+' → '++').

/** Storage-safe alphabet for one encoded segment ('/' excluded on purpose). */
const STORAGE_SAFE_SEGMENT_RE = /^[A-Za-z0-9_! .'()*&$@=;:+,?~-]+$/;
const STORAGE_SAFE_STRIP_RE = /[^A-Za-z0-9_! .'()*&$@=;:+,?~-]/g;

/** Fold accented latin characters to ASCII, drop the rest. */
function foldToAscii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\u0020-\u007e]/g, '');
}

/**
 * Clean one path segment to the storage-safe alphabet. Shared by single
 * names and folder segments; inputs that already upload successfully are
 * unaffected (their characters all survive this pipeline unchanged).
 */
export function sanitizePathSegment(segment: string): string {
  const cleaned = foldToAscii(segment)
    .replace(STORAGE_SAFE_STRIP_RE, '')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, PROJECT_FILE_MAX_NAME_LENGTH);
}

/**
 * Encode a browser relative path ("docs/spec.pdf") into one storage-safe
 * segment ("docs+spec.pdf"). Returns null when the path carries no folder
 * structure or cannot be represented safely (caller reports a skip).
 */
export function encodeRelativePath(relativePath: string): string | null {
  const segments = relativePath
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length < 2) return null;
  const clean = segments.map(sanitizePathSegment);
  if (clean.some((s) => s.length === 0)) return null;
  const encoded = clean.map((s) => s.split(FOLDER_SEPARATOR).join(`${FOLDER_SEPARATOR}${FOLDER_SEPARATOR}`)).join(FOLDER_SEPARATOR);
  if (!encoded || encoded.length > PROJECT_FILE_MAX_NAME_LENGTH) return null;
  if (!STORAGE_SAFE_SEGMENT_RE.test(encoded)) return null;
  return encoded;
}

/** Split an encoded storage name back into folders + filename. */
export function decodeStorageName(stored: string): { folders: string[]; fileName: string } {
  const segments: string[] = [];
  let current = '';
  for (let i = 0; i < stored.length; i++) {
    const ch = stored[i];
    if (ch === FOLDER_SEPARATOR) {
      if (stored[i + 1] === FOLDER_SEPARATOR) {
        current += FOLDER_SEPARATOR;
        i++;
      } else {
        segments.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  segments.push(current);
  if (segments.length === 1) return { folders: [], fileName: stored };
  return { folders: segments.slice(0, -1), fileName: segments[segments.length - 1] };
}

/** Folder portion (possibly empty) of a file's storage path for grouping. */
export function getStoredFolderPath(storagePath: string): string[] {
  const last = storagePath.split('/').pop() ?? storagePath;
  return decodeStorageName(last).folders;
}

// ── Validation (UX only — the database and Storage RLS are authoritative) ────
// NOTE: browser-supplied file.type / size are hints, not security signals.

export function validateFile(file: File): string | null {
  const name = file.name.trim();
  if (!name) return 'File must have a name.';
  if (name.length > PROJECT_FILE_MAX_NAME_LENGTH) {
    return `Filename cannot exceed ${PROJECT_FILE_MAX_NAME_LENGTH} characters.`;
  }
  if (file.size === 0) return 'Empty files cannot be uploaded.';
  if (file.size > PROJECT_FILE_MAX_SIZE) {
    return `File exceeds the ${formatFileSize(PROJECT_FILE_MAX_SIZE)} limit.`;
  }
  const ext = getFileExtension(name);
  if (!ext || !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return `File type ".${ext || '?'}" is not supported. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`;
  }
  return null;
}
