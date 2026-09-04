// ── Global Search (Phase 8) ──────────────────────────────────────────────────
// Workspace-scoped results across projects, posts, tasks, and files.
// Every row originates from an RLS-authorized query; nothing here bypasses
// row-level security.

export type SearchResultType = 'project' | 'post' | 'task' | 'file';

export interface SearchResultItem {
  /** Stable palette key: `${type}:${id}`. */
  key: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  target: string;
}

export interface SearchResults {
  projects: SearchResultItem[];
  posts: SearchResultItem[];
  tasks: SearchResultItem[];
  files: SearchResultItem[];
}

export const EMPTY_SEARCH_RESULTS: SearchResults = {
  projects: [],
  posts: [],
  tasks: [],
  files: [],
};

/** Minimum characters before a query is issued. */
export const SEARCH_MIN_LENGTH = 2;

/** Per-entity result cap: bounded queries, no table scans into the browser. */
export const SEARCH_LIMIT_PER_ENTITY = 8;

/** Debounce delay for keystrokes. */
export const SEARCH_DEBOUNCE_MS = 300;

export const SEARCH_TYPE_LABELS: Record<SearchResultType, string> = {
  project: 'Projects',
  post: 'Posts',
  task: 'Tasks',
  file: 'Files',
};
