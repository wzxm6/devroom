-- ============================================================================
-- DevRoom Migration: 20260904050000_devroom_chat.sql
-- Phase 5A: Chat Database + Security Foundation (no UI)
-- Global workspace chat (project_id IS NULL) + project-scoped discussion.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CHAT MESSAGES TABLE
-- ----------------------------------------------------------------------------
-- Scope rule: a global message belongs to exactly one workspace
-- (project_id IS NULL); a project message belongs to a project AND that
-- project's workspace. The project -> workspace relationship is already
-- guaranteed by projects.workspace_id (NOT NULL FK), so workspace_id here is
-- enforced to match it (see trigger in section 4) rather than re-derived.
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id   UUID        NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 2000),
  is_edited    BOOLEAN     NOT NULL DEFAULT false,
  is_deleted   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES (chronological retrieval per scope)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace_created
  ON public.chat_messages(workspace_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created
  ON public.chat_messages(project_id, created_at ASC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_author_id
  ON public.chat_messages(author_id);

-- ----------------------------------------------------------------------------
-- 3. AUTOMATIC updated_at TRIGGER
--    Reuses the set_updated_at() function defined in Phase 3 migration.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. SCOPE VALIDATION TRIGGER
--    Guarantees chat_messages.workspace_id = projects.workspace_id for
--    project-scoped messages, and forbids moving a message between scopes
--    (workspace_id / project_id are immutable after insert).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_chat_message_scope()
RETURNS TRIGGER AS $$
DECLARE
  project_ws_id UUID;
BEGIN
  -- Scope columns are immutable: a message cannot be moved between
  -- workspaces or between global and project scopes via UPDATE.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'Chat message scope (workspace_id, project_id) is immutable.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Project messages must live in the project's own workspace.
  IF NEW.project_id IS NOT NULL THEN
    SELECT p.workspace_id INTO project_ws_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;

    IF project_ws_id IS NULL OR project_ws_id <> NEW.workspace_id THEN
      RAISE EXCEPTION 'Chat message workspace_id must match the project workspace_id.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_messages_validate_scope ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_validate_scope
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_message_scope();

-- ----------------------------------------------------------------------------
-- 5. HELPER FUNCTION: is_chat_message_accessible
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_chat_message_accessible(lookup_message_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = lookup_message_id
      AND (
        -- Global message: member or owner of the workspace
        (m.project_id IS NULL AND (
          public.is_workspace_member(m.workspace_id) OR
          public.is_workspace_owner(m.workspace_id)
        ))
        OR
        -- Project message: member of the project (covers workspace member/owner)
        (m.project_id IS NOT NULL AND public.is_project_member(m.project_id))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace members/owners see global messages; project members see
-- project messages. The scope-match trigger guarantees workspace_id is
-- consistent, so project membership alone is sufficient for project rows.
CREATE POLICY "Chat messages viewable by scope members"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    (project_id IS NULL AND (
      public.is_workspace_member(workspace_id) OR
      public.is_workspace_owner(workspace_id)
    ))
    OR
    (project_id IS NOT NULL AND public.is_project_member(project_id))
  );

-- INSERT: sender must be the author (no spoofing), must belong to the target
-- scope, and a project message must reference a project inside the message
-- workspace (defense in depth alongside the scope trigger).
CREATE POLICY "Scope members can send chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    (
      (project_id IS NULL AND (
        public.is_workspace_member(workspace_id) OR
        public.is_workspace_owner(workspace_id)
      ))
      OR
      (project_id IS NOT NULL AND
        public.is_project_member(project_id) AND
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = project_id
            AND p.workspace_id = workspace_id
        ))
    )
  );

-- UPDATE: only the author may edit/soft-delete their own message, and the
-- resulting row must keep the same author and remain in an accessible scope.
CREATE POLICY "Authors can update own messages"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid() AND
    (
      (project_id IS NULL AND (
        public.is_workspace_member(workspace_id) OR
        public.is_workspace_owner(workspace_id)
      ))
      OR
      (project_id IS NOT NULL AND public.is_project_member(project_id))
    )
  )
  WITH CHECK (
    author_id = auth.uid() AND
    (
      (project_id IS NULL AND (
        public.is_workspace_member(workspace_id) OR
        public.is_workspace_owner(workspace_id)
      ))
      OR
      (project_id IS NOT NULL AND
        public.is_project_member(project_id) AND
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = project_id
            AND p.workspace_id = workspace_id
        ))
    )
  );

-- DELETE: message author or workspace owner (moderation), consistent with the
-- posts/comments authorization model. workspace_id is authoritative for both
-- scopes because the trigger guarantees it matches the project workspace.
CREATE POLICY "Authors or workspace owners can delete messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

-- ----------------------------------------------------------------------------
-- 7. ENABLE REALTIME REPLICATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;
