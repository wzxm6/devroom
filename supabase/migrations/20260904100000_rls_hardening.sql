-- ============================================================================
-- DevRoom Migration: 20260904100000_rls_hardening.sql
-- Phase 10: Corrective RLS hardening (additive, no behavior removed)
--
-- Finding 1 (medium): workspace_members INSERT accepted ANY authenticated
--   user's self-insert into ANY workspace (user_id = auth.uid() sufficed),
--   so invite codes were enforced only by the join RPC, not by RLS. Fixed by
--   restricting direct INSERTs to workspace owners. Safe: workspace creation
--   inserts the owner row as the owner, and invite joins go through the
--   SECURITY DEFINER join_workspace_by_invite() RPC which bypasses RLS.
--
-- Finding 2 (medium): projects.workspace_id was mutable — a project creator
--   could move a project into an arbitrary workspace via UPDATE (the WITH
--   CHECK creator path never verified workspace membership), leaking the
--   project into that workspace. Fixed by making workspace_id immutable.
--   Safe: no UI or service ever moves projects between workspaces.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. workspace_members INSERT: owners only (joins go through the invite RPC)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can join workspace or owner can add members"
  ON public.workspace_members;

CREATE POLICY "Workspace owners can add members"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id)
  );

-- ----------------------------------------------------------------------------
-- 2. projects.workspace_id: immutable after creation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_project_workspace_move()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'Projects cannot be moved between workspaces.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_projects_workspace_immutable ON public.projects;
CREATE TRIGGER trg_projects_workspace_immutable
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_workspace_move();
