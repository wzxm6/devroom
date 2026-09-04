-- ============================================================================
-- DevRoom Migration: 20260904010000_devroom_projects.sql
-- Phase 2 Projects: Projects table, constraints, indexes, and RLS policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROJECTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- SELECT: Members and owners of the project's workspace can view projects
CREATE POLICY "Projects viewable by workspace members"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id) OR
    public.is_workspace_owner(workspace_id)
  );

-- INSERT: Authenticated members of the workspace can create projects
-- created_by must correspond to the authenticated user
CREATE POLICY "Workspace members can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    (
      public.is_workspace_member(workspace_id) OR
      public.is_workspace_owner(workspace_id)
    )
  );

-- UPDATE: Project creator or workspace owner can update project
CREATE POLICY "Creator or workspace owner can update project"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  )
  WITH CHECK (
    created_by = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

-- DELETE: Project creator or workspace owner can delete project
CREATE POLICY "Creator or workspace owner can delete project"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );
