-- ============================================================================
-- DevRoom Migration: 20260904080000_devroom_search.sql
-- Phase 8: Global Search (Postgres Full-Text Search, no new infrastructure)
--
-- Adds stored generated tsvector columns + GIN indexes for workspace-scoped
-- search over projects, posts, tasks, and project filenames.
--
-- SECURITY: these columns/indexes change nothing about authorization. Every
-- search query runs authenticated through the existing table RLS policies,
-- so rows outside the caller's workspace can never match or leak.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROJECTS: name + description
-- ----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_projects_search_vector
  ON public.projects USING GIN (search_vector);

-- ----------------------------------------------------------------------------
-- 2. POSTS: title + content
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_search_vector
  ON public.posts USING GIN (search_vector);

-- ----------------------------------------------------------------------------
-- 3. TASKS: title + description
-- ----------------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tasks_search_vector
  ON public.tasks USING GIN (search_vector);

-- ----------------------------------------------------------------------------
-- 4. PROJECT FILES: original filename only (no file-content indexing)
-- ----------------------------------------------------------------------------
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(original_name, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_project_files_search_vector
  ON public.project_files USING GIN (search_vector);
