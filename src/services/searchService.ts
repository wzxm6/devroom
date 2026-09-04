import { supabase } from '@/lib/supabase/client';
import { supabaseConfig } from '@/lib/supabase/config';
import {
  SearchResults,
  SearchResultItem,
  EMPTY_SEARCH_RESULTS,
  SEARCH_LIMIT_PER_ENTITY,
  SEARCH_MIN_LENGTH,
} from '@/types/search';
import { formatFileSize } from '@/lib/fileUtils';

// ── Trust boundaries ─────────────────────────────────────────────────────────
// All four queries run authenticated through the existing table RLS policies
// (projects / posts / tasks / project_files SELECT). Titles, snippets, IDs,
// and filenames in the results therefore come exclusively from rows the
// caller is already authorized to read — search cannot leak anything RLS
// would hide. No service-role client exists in this codebase.

const excerpt = (text: string | null | undefined, length = 120): string | null => {
  if (!text) return null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.length > length ? `${trimmed.slice(0, length)}…` : trimmed;
};

type ProjectNameRow = { id: string; name: string };
const projectName = (row: { project?: ProjectNameRow | ProjectNameRow[] | null }): string | null => {
  const p = row.project;
  if (!p) return null;
  return Array.isArray(p) ? (p[0]?.name ?? null) : p.name;
};

const projectIdOf = (row: { project_id?: string | null }): string | null =>
  row.project_id ?? null;

// ── Service ──────────────────────────────────────────────────────────────────

export const searchService = {
  /**
   * Workspace-scoped full-text search across projects, posts, tasks, and
   * project filenames. Each entity is capped; short queries return empty
   * groups without hitting the database.
   */
  async searchWorkspace(workspaceId: string, query: string): Promise<SearchResults> {
    const q = query.trim();
    if (!supabaseConfig.isConfigured) return EMPTY_SEARCH_RESULTS;
    if (q.length < SEARCH_MIN_LENGTH) return EMPTY_SEARCH_RESULTS;

    try {
      // Workspace project IDs scope the post/task queries (same pattern as
      // taskService.getWorkspaceTasks). A single query, not N+1.
      const { data: projectRows, error: projectIdsError } = await supabase
        .from('projects')
        .select('id')
        .eq('workspace_id', workspaceId);

      if (projectIdsError) {
        console.error('Error scoping workspace search:', projectIdsError);
        throw new Error('Search is unavailable right now.');
      }

      const projectIds = (projectRows || []).map((p) => p.id);

      const [projectsRes, postsRes, tasksRes, filesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, description')
          .eq('workspace_id', workspaceId)
          .textSearch('search_vector', q, { type: 'plain', config: 'english' })
          .limit(SEARCH_LIMIT_PER_ENTITY),
        projectIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from('posts')
              .select('id, title, content, project_id, project:projects(id, name)')
              .in('project_id', projectIds)
              .textSearch('search_vector', q, { type: 'plain', config: 'english' })
              .limit(SEARCH_LIMIT_PER_ENTITY),
        projectIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from('tasks')
              .select('id, title, description, status, project_id, project:projects(id, name)')
              .in('project_id', projectIds)
              .textSearch('search_vector', q, { type: 'plain', config: 'english' })
              .limit(SEARCH_LIMIT_PER_ENTITY),
        supabase
          .from('project_files')
          .select('id, original_name, mime_type, size_bytes, project_id, project:projects(id, name)')
          .eq('workspace_id', workspaceId)
          .textSearch('search_vector', q, { type: 'plain', config: 'english' })
          .limit(SEARCH_LIMIT_PER_ENTITY),
      ]);

      for (const res of [projectsRes, postsRes, tasksRes, filesRes]) {
        if (res.error) {
          console.error('Error running workspace search:', res.error);
          throw new Error('Search is unavailable right now.');
        }
      }

      const projects: SearchResultItem[] = ((projectsRes.data || []) as {
        id: string;
        name: string;
        description: string | null;
      }[]).map((p) => ({
        key: `project:${p.id}`,
        type: 'project',
        title: p.name,
        subtitle: excerpt(p.description),
        target: `/projects/${p.id}`,
      }));

      const posts: SearchResultItem[] = ((postsRes.data || []) as {
        id: string;
        title: string;
        content: string;
        project_id: string;
        project?: ProjectNameRow | ProjectNameRow[] | null;
      }[]).map((p) => {
        const name = projectName(p);
        const body = excerpt(p.content, 100);
        return {
          key: `post:${p.id}`,
          type: 'post',
          title: p.title,
          subtitle: [name, body].filter(Boolean).join(' · ') || null,
          target: `/projects/${p.project_id}/posts/${p.id}`,
        };
      });

      const tasks: SearchResultItem[] = ((tasksRes.data || []) as {
        id: string;
        title: string;
        description: string | null;
        project_id: string;
        project?: ProjectNameRow | ProjectNameRow[] | null;
      }[]).map((t) => {
        const pid = projectIdOf(t);
        const name = projectName(t);
        const body = excerpt(t.description, 100);
        return {
          key: `task:${t.id}`,
          type: 'task',
          title: t.title,
          subtitle: [name, body].filter(Boolean).join(' · ') || null,
          target: pid ? `/projects/${pid}?tab=tasks` : '/tasks',
        };
      });

      const files: SearchResultItem[] = ((filesRes.data || []) as {
        id: string;
        original_name: string;
        size_bytes: number;
        project_id: string;
        project?: ProjectNameRow | ProjectNameRow[] | null;
      }[]).map((f) => {
        const pid = projectIdOf(f);
        const name = projectName(f);
        const meta = `${formatFileSize(f.size_bytes)}${name ? ` · ${name}` : ''}`;
        return {
          key: `file:${f.id}`,
          type: 'file',
          title: f.original_name,
          subtitle: meta,
          target: pid ? `/projects/${pid}?tab=files` : '/tasks',
        };
      });

      return { projects, posts, tasks, files };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('An unexpected error occurred while searching.');
    }
  },
};
