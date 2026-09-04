-- ============================================================================
-- DevRoom Migration: 20260904030000_devroom_tasks.sql
-- Phase 4: Task Management, Kanban Board, RLS, Triggers, Realtime
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TASKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 500),
  description TEXT        CHECK (description IS NULL OR char_length(description) <= 5000),
  assigned_to UUID        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status      TEXT        NOT NULL DEFAULT 'TODO'
                          CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  priority    TEXT        NOT NULL DEFAULT 'MEDIUM'
                          CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  due_date    DATE        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_project_id   ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by   ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority      ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at    ON public.tasks(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. AUTOMATIC updated_at TRIGGER
--    Reuses the set_updated_at() function defined in Phase 3 migration.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_task_accessible(lookup_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = lookup_task_id
      AND public.is_project_member(t.project_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if a specific user is a member of the workspace that owns a project
CREATE OR REPLACE FUNCTION public.is_workspace_member_of_project(
  lookup_project_id UUID,
  lookup_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = lookup_project_id
      AND wm.user_id = lookup_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Validate that assigned_to is either null or a member of the task's project workspace
CREATE OR REPLACE FUNCTION public.validate_task_assignee()
RETURNS TRIGGER AS $$
DECLARE
  project_ws_id UUID;
BEGIN
  SELECT p.workspace_id INTO project_ws_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF NEW.assigned_to IS NOT NULL AND project_ws_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = project_ws_id AND user_id = NEW.assigned_to
    ) THEN
      RAISE EXCEPTION 'Cannot assign task to a user who is not a member of the project workspace.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_validate_assignee ON public.tasks;
CREATE TRIGGER trg_tasks_validate_assignee
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_assignee();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by project members"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Project members can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    public.is_project_member(project_id) AND
    (assigned_to IS NULL OR public.is_workspace_member_of_project(project_id, assigned_to))
  );

CREATE POLICY "Task creator, assignee, or owner can update"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.is_project_member(project_id) AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND public.is_workspace_owner(p.workspace_id)
      )
    )
  )
  WITH CHECK (
    public.is_project_member(project_id) AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND public.is_workspace_owner(p.workspace_id)
      )
    ) AND
    (assigned_to IS NULL OR public.is_workspace_member_of_project(project_id, assigned_to))
  );

CREATE POLICY "Task creator or workspace owner can delete"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.is_workspace_owner(p.workspace_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 6. ENABLE REALTIME REPLICATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;
