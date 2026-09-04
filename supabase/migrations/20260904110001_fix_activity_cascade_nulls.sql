-- ============================================================================
-- DevRoom Migration: 20260904110001_fix_activity_cascade_nulls.sql
-- Staging follow-up: cascade-safe DELETE branches, part 2.
--
-- Staging proved that during cascades (e.g. deleting a post with comments,
-- or a workspace with everything), a child DELETE trigger can run after its
-- parent row is already gone. The scope lookup then yields NULL and the
-- audit write dies on the NOT NULL constraint — aborting the source DELETE.
-- Fix: when the scope cannot be resolved in a DELETE branch, skip the event
-- (the scope's history cascades away regardless). Normal deletes resolve
-- fine and still emit.
-- ============================================================================

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
      IF v_ws IS NULL THEN
        RETURN OLD;
      END IF;
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
      IF v_ws IS NULL THEN
        RETURN OLD;
      END IF;
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
      IF v_ws IS NULL THEN
        RETURN OLD;
      END IF;
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
