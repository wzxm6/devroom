-- ============================================================================
-- DevRoom Migration: 20260904060000_devroom_files.sql
-- Phase 6: Private Project Files (database metadata + Storage, no UI)
-- Private `project-files` bucket + project_files metadata with strict
-- workspace/project scope enforcement at the database level.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROJECT FILES METADATA TABLE
-- ----------------------------------------------------------------------------
-- workspace_id is stored intentionally for RLS/query efficiency, but it is
-- NOT trusted: the scope trigger (section 4) and RLS WITH CHECK both enforce
-- project_files.workspace_id = projects.workspace_id.
CREATE TABLE IF NOT EXISTS public.project_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  uploaded_by   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path  TEXT        NOT NULL CHECK (char_length(trim(storage_path)) > 0 AND char_length(storage_path) <= 1024),
  original_name TEXT        NOT NULL CHECK (char_length(trim(original_name)) > 0 AND char_length(original_name) <= 255),
  mime_type     TEXT        NULL CHECK (mime_type IS NULL OR char_length(mime_type) <= 127),
  size_bytes    BIGINT      NOT NULL CHECK (size_bytes >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_project_files_project_created
  ON public.project_files(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_workspace_id
  ON public.project_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_files_uploaded_by
  ON public.project_files(uploaded_by);

-- ----------------------------------------------------------------------------
-- 3. AUTOMATIC updated_at TRIGGER
--    Reuses the set_updated_at() function defined in Phase 3 migration.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_project_files_updated_at ON public.project_files;
CREATE TRIGGER trg_project_files_updated_at
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. SCOPE VALIDATION TRIGGER
--    Guarantees project_files.workspace_id = projects.workspace_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_project_file_scope()
RETURNS TRIGGER AS $$
DECLARE
  project_ws_id UUID;
BEGIN
  SELECT p.workspace_id INTO project_ws_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF project_ws_id IS NULL OR project_ws_id <> NEW.workspace_id THEN
    RAISE EXCEPTION 'Project file workspace_id must match the project workspace_id.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_project_files_validate_scope ON public.project_files;
CREATE TRIGGER trg_project_files_validate_scope
  BEFORE INSERT OR UPDATE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_project_file_scope();

-- ----------------------------------------------------------------------------
-- 5. HELPER FUNCTION: is_project_file_accessible
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_file_accessible(lookup_file_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.project_files f
    WHERE f.id = lookup_file_id
      AND public.is_project_member(f.project_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 6. DATABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
-- NOTE: there is intentionally NO UPDATE policy. Phase 6 has no metadata
-- editing feature, so updates are denied by default (least privilege).
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the file's project (covers workspace member/owner).
CREATE POLICY "Project files viewable by project members"
  ON public.project_files FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

-- INSERT: project members only, uploader must be the sender (no spoofing),
-- and the file must be filed under the project's own workspace (defense in
-- depth alongside the scope trigger).
CREATE POLICY "Project members can upload file metadata"
  ON public.project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    public.is_project_member(project_id) AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.workspace_id = workspace_id
    )
  );

-- DELETE: uploader can delete their own files; workspace owners can moderate
-- any project file in their workspace (consistent with posts/comments/tasks).
CREATE POLICY "Uploader or workspace owner can delete file metadata"
  ON public.project_files FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

-- ----------------------------------------------------------------------------
-- 7. PRIVATE STORAGE BUCKET
-- ----------------------------------------------------------------------------
-- The bucket is private: no public reads, with a server-side 50 MB object
-- size cap that backs up the client-side validation.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-files', 'project-files', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 52428800;

-- ----------------------------------------------------------------------------
-- 8. STORAGE PATH HELPERS
-- ----------------------------------------------------------------------------
-- Object paths have the shape <workspace_id>/<project_id>/<file_id>/<name>.
-- These helpers parse the leading workspace segment safely (malformed paths
-- yield NULL, which can never satisfy a membership check).
CREATE OR REPLACE FUNCTION public.storage_path_workspace_id(path TEXT)
RETURNS UUID AS $$
DECLARE
  parts TEXT[];
BEGIN
  parts := string_to_array(path, '/');
  IF parts IS NULL OR array_length(parts, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN (parts[1])::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.is_storage_path_workspace_member(path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  ws_id UUID;
BEGIN
  ws_id := public.storage_path_workspace_id(path);
  IF ws_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.is_workspace_member(ws_id) OR public.is_workspace_owner(ws_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 9. STORAGE OBJECT POLICIES (server-side authorization for the bucket)
-- ----------------------------------------------------------------------------
-- NOTE: there is intentionally NO UPDATE policy on storage.objects, so
-- objects can never be overwritten (not even by their uploader). Re-uploads
-- create new file records with new paths instead.

-- SELECT: workspace members/owners may read objects scoped to their workspace.
-- Path guessing is useless: any path outside the caller's workspace is denied.
CREATE POLICY "Project file objects readable by workspace members"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-files' AND
    public.is_storage_path_workspace_member(name)
  );

-- INSERT: members may upload only into their own workspace scope, using the
-- exact 4-segment layout <workspace>/<project>/<file>/<name>. Arbitrary deep
-- or shallow paths are rejected.
CREATE POLICY "Project file objects uploadable by workspace members"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files' AND
    array_length(string_to_array(name, '/'), 1) = 4 AND
    public.is_storage_path_workspace_member(name)
  );

-- DELETE: the uploader of the linked metadata row, or the workspace owner
-- (moderation). Membership in the path scope is always required first.
CREATE POLICY "Project file objects deletable by uploader or owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-files' AND
    public.is_storage_path_workspace_member(name) AND
    (
      public.is_workspace_owner(public.storage_path_workspace_id(name)) OR
      EXISTS (
        SELECT 1 FROM public.project_files pf
        WHERE pf.storage_path = storage.objects.name
          AND pf.uploaded_by = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 10. ENABLE REALTIME REPLICATION (metadata only)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_files;
  END IF;
END $$;
