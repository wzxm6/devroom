-- ============================================================================
-- DevRoom Migration: 20260904110000_fix_activity_triggers.sql
-- Phase 10 staging fixes (additive, behavior-preserving except as noted)
--
-- Fix 1 (critical): notify_mentioned_users() called lower() on the whole
--   regexp_matches array instead of its first element. Unknown-function
--   errors are raised at plan time, so EVERY post/comment/chat INSERT failed
--   in staging. Fixed by indexing the match: lower((x.match)[1]).
--
-- Fix 2 (critical): DELETE-branch activity emits violated FK constraints
--   during cascades (e.g. deleting a workspace cascades projects whose
--   DELETE trigger then inserts history referencing the dying workspace;
--   deleting a project cascades children whose triggers reference the dying
--   project). The source DELETE is aborted by the audit write. Fixed by
--   skipping the child-deleted event when its scope is itself being torn
--   down (ON DELETE CASCADE already removes that scope's history, so nothing
--   is lost; the top-level deleted event is still recorded).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fix 1: mention matching indexes the capture group
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_mentioned_users(
  p_event_id UUID,
  p_workspace_id UUID,
  p_content TEXT,
  p_actor_id UUID,
  p_project_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS void AS $$
BEGIN
  IF p_content IS NULL OR p_content = '' THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications
    (activity_event_id, recipient_id, workspace_id, project_id,
     notification_type, title, body, entity_type, entity_id)
  SELECT p_event_id, m.user_id, p_workspace_id, p_project_id,
         'mention', p_title, p_body, p_entity_type, p_entity_id
  FROM (
    SELECT DISTINCT lower((x.match)[1]) AS username
    FROM regexp_matches(p_content, '@([A-Za-z0-9_]+)', 'g') AS x(match)
  ) men
  JOIN public.profiles pr ON pr.username = men.username
  JOIN public.workspace_members m ON m.user_id = pr.id AND m.workspace_id = p_workspace_id
  WHERE m.user_id IS DISTINCT FROM p_actor_id
  ON CONFLICT (activity_event_id, recipient_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Fix 2: cascade-safe DELETE branches (one guarded emit per entity)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_event UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_activity(
      NEW.workspace_id, NEW.id, v_actor, 'project', NEW.id, 'project.created',
      jsonb_build_object('title', NEW.name, 'status', NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := public.emit_activity(
        NEW.workspace_id, NEW.id, v_actor, 'project', NEW.id, 'project.status_changed',
        jsonb_build_object('title', NEW.name, 'old_status', OLD.status, 'new_status', NEW.status));
    ELSIF NEW.name IS DISTINCT FROM OLD.name OR NEW.description IS DISTINCT FROM OLD.description THEN
      v_event := public.emit_activity(
        NEW.workspace_id, NEW.id, v_actor, 'project', NEW.id, 'project.updated',
        jsonb_build_object('title', NEW.name));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      PERFORM public.emit_activity(
        OLD.workspace_id, NULL, v_actor, 'project', OLD.id, 'project.deleted',
        jsonb_build_object('title', OLD.name));
    EXCEPTION WHEN foreign_key_violation THEN
      -- Parent workspace is being torn down; its history cascades away.
      NULL;
    END;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_post_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_event UUID;
  v_ws UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = NEW.project_id;
    v_event := public.emit_activity(
      v_ws, NEW.project_id, v_actor, 'post', NEW.id, 'post.created',
      jsonb_build_object('title', NEW.title));
    PERFORM public.notify_mentioned_users(
      v_event, v_ws, NEW.content, v_actor, NEW.project_id, 'post', NEW.id,
      'Mentioned in "' || left(NEW.title, 80) || '"',
      left(NEW.content, 140));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
      SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = NEW.project_id;
      PERFORM public.emit_activity(
        v_ws, NEW.project_id, v_actor, 'post', NEW.id, 'post.updated',
        jsonb_build_object('title', NEW.title));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = OLD.project_id;
      PERFORM public.emit_activity(
        v_ws, OLD.project_id, v_actor, 'post', OLD.id, 'post.deleted',
        jsonb_build_object('title', OLD.title));
    EXCEPTION WHEN foreign_key_violation THEN
      -- Parent project/workspace is being torn down; history cascades away.
      NULL;
    END;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_comment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_event UUID;
  v_ws UUID;
  v_post_author UUID;
  v_post_title TEXT;
  v_post_project UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.author_id, p.title, p.project_id, pr.workspace_id
      INTO v_post_author, v_post_title, v_post_project, v_ws
    FROM public.posts p
    JOIN public.projects pr ON pr.id = p.project_id
    WHERE p.id = NEW.post_id;
    v_event := public.emit_activity(
      v_ws, v_post_project, v_actor, 'comment', NEW.id, 'comment.created',
      jsonb_build_object('post_id', NEW.post_id, 'excerpt', left(NEW.content, 140)));
    IF v_post_author IS NOT NULL AND v_post_author IS DISTINCT FROM v_actor THEN
      PERFORM public.notify_user(
        v_event, v_post_author, v_ws, v_post_project, 'comment',
        'New comment on "' || left(COALESCE(v_post_title, 'a post'), 80) || '"',
        left(NEW.content, 140), 'post', NEW.post_id);
    END IF;
    PERFORM public.notify_mentioned_users(
      v_event, v_ws, NEW.content, v_actor, v_post_project, 'post', NEW.post_id,
      'Mentioned in a comment',
      left(NEW.content, 140));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      SELECT pr.workspace_id, p.project_id
        INTO v_ws, v_post_project
      FROM public.posts p
      JOIN public.projects pr ON pr.id = p.project_id
      WHERE p.id = NEW.post_id;
      PERFORM public.emit_activity(
        v_ws, v_post_project, v_actor, 'comment', NEW.id, 'comment.deleted',
        jsonb_build_object('post_id', NEW.post_id));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      SELECT pr.workspace_id, p.project_id
        INTO v_ws, v_post_project
      FROM public.posts p
      JOIN public.projects pr ON pr.id = p.project_id
      WHERE p.id = OLD.post_id;
      PERFORM public.emit_activity(
        v_ws, v_post_project, v_actor, 'comment', OLD.id, 'comment.deleted',
        jsonb_build_object('post_id', OLD.post_id));
    EXCEPTION WHEN foreign_key_violation THEN
      -- Parent post/project is being torn down; history cascades away.
      NULL;
    END;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_event UUID;
  v_ws UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = NEW.project_id;
    v_event := public.emit_activity(
      v_ws, NEW.project_id, v_actor, 'task', NEW.id, 'task.created',
      jsonb_build_object('title', NEW.title, 'status', NEW.status, 'priority', NEW.priority));
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM v_actor THEN
      PERFORM public.notify_user(
        v_event, NEW.assigned_to, v_ws, NEW.project_id, 'task_assigned',
        'Assigned: "' || left(NEW.title, 80) || '"',
        'You were assigned to this task.', 'task', NEW.id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = NEW.project_id;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := public.emit_activity(
        v_ws, NEW.project_id, v_actor, 'task', NEW.id, 'task.status_changed',
        jsonb_build_object('title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status));
      IF NEW.status = 'DONE' AND NEW.created_by IS DISTINCT FROM v_actor THEN
        PERFORM public.notify_user(
          v_event, NEW.created_by, v_ws, NEW.project_id, 'task_completed',
          'Completed: "' || left(NEW.title, 80) || '"',
          'This task was marked done.', 'task', NEW.id);
      END IF;
    ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      v_event := public.emit_activity(
        v_ws, NEW.project_id, v_actor, 'task', NEW.id, 'task.assigned',
        jsonb_build_object('title', NEW.title));
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM v_actor THEN
        PERFORM public.notify_user(
          v_event, NEW.assigned_to, v_ws, NEW.project_id, 'task_assigned',
          'Assigned: "' || left(NEW.title, 80) || '"',
          'You were assigned to this task.', 'task', NEW.id);
      END IF;
    ELSIF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      v_event := public.emit_activity(
        v_ws, NEW.project_id, v_actor, 'task', NEW.id, 'task.updated',
        jsonb_build_object('title', NEW.title));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = OLD.project_id;
      PERFORM public.emit_activity(
        v_ws, OLD.project_id, v_actor, 'task', OLD.id, 'task.deleted',
        jsonb_build_object('title', OLD.title));
    EXCEPTION WHEN foreign_key_violation THEN
      -- Parent project/workspace is being torn down; history cascades away.
      NULL;
    END;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_file_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_activity(
      NEW.workspace_id, NEW.project_id, v_actor, 'file', NEW.id, 'file.uploaded',
      jsonb_build_object('filename', NEW.original_name, 'size_bytes', NEW.size_bytes));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      PERFORM public.emit_activity(
        OLD.workspace_id, OLD.project_id, v_actor, 'file', OLD.id, 'file.deleted',
        jsonb_build_object('filename', OLD.original_name));
    EXCEPTION WHEN foreign_key_violation THEN
      -- Parent project/workspace is being torn down; history cascades away.
      NULL;
    END;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
