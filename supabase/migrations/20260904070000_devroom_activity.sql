-- ============================================================================
-- DevRoom Migration: 20260904070000_devroom_activity.sql
-- Phase 7: Activity Feed + Notifications (awareness layer)
--
-- DESIGN: events and notifications are generated SERVER-SIDE by triggers.
-- There are NO INSERT/UPDATE/DELETE RLS policies for ordinary clients on
-- activity_events, and no INSERT/DELETE (nor direct UPDATE) on
-- notifications. A malicious client therefore cannot forge actors, actions,
-- entity IDs, timestamps, recipients, or cross-workspace events. Read state
-- changes go through narrow SECURITY DEFINER RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACTIVITY EVENTS TABLE (append-only audit/history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id   UUID        NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  actor_id     UUID        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type  TEXT        NOT NULL CHECK (entity_type IN ('project', 'post', 'comment', 'task', 'message', 'file')),
  entity_id    UUID        NULL,
  action       TEXT        NOT NULL,
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_workspace_created
  ON public.activity_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_project_created
  ON public.activity_events(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_entity
  ON public.activity_events(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATIONS TABLE (per-recipient attention items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id      UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id        UUID        NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  activity_event_id UUID        NULL REFERENCES public.activity_events(id) ON DELETE SET NULL,
  notification_type TEXT        NOT NULL CHECK (notification_type IN ('comment', 'mention', 'task_assigned', 'task_completed')),
  title             TEXT        NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 300),
  body              TEXT        NULL CHECK (body IS NULL OR char_length(body) <= 500),
  entity_type       TEXT        NULL,
  entity_id         UUID        NULL,
  is_read           BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at           TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC);

-- Duplicate prevention: one row per (event, recipient). Legitimate repeats
-- produce distinct events, so they still notify; retries/conflicting rules
-- for the same event collapse via ON CONFLICT DO NOTHING.
ALTER TABLE public.notifications
  ADD CONSTRAINT uq_notifications_event_recipient
  UNIQUE NULLS NOT DISTINCT (activity_event_id, recipient_id);

-- ----------------------------------------------------------------------------
-- 3. CENTRAL EMIT + NOTIFY HELPERS (SECURITY DEFINER: bypass client RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_activity(
  p_workspace_id UUID,
  p_project_id UUID,
  p_actor_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.activity_events
    (workspace_id, project_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES
    (p_workspace_id, p_project_id, p_actor_id, p_entity_type, p_entity_id, p_action, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_user(
  p_event_id UUID,
  p_recipient_id UUID,
  p_workspace_id UUID,
  p_project_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS void AS $$
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications
    (activity_event_id, recipient_id, workspace_id, project_id,
     notification_type, title, body, entity_type, entity_id)
  VALUES
    (p_event_id, p_recipient_id, p_workspace_id, p_project_id,
     p_type, p_title, p_body, p_entity_type, p_entity_id)
  ON CONFLICT (activity_event_id, recipient_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mention recipients are derived server-side from content + membership:
-- @usernames are matched against workspace member profiles, the actor is
-- excluded, and outsiders can never match. Reuses the plain @username
-- representation used by the post/comment/chat composers.
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
    SELECT DISTINCT lower(x.match) AS username
    FROM regexp_matches(p_content, '@([A-Za-z0-9_]+)', 'g') AS x(match)
  ) men
  JOIN public.profiles pr ON pr.username = men.username
  JOIN public.workspace_members m ON m.user_id = pr.id AND m.workspace_id = p_workspace_id
  WHERE m.user_id IS DISTINCT FROM p_actor_id
  ON CONFLICT (activity_event_id, recipient_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. ENTITY TRIGGER FUNCTIONS
-- ----------------------------------------------------------------------------
-- Single-event rule: each operation emits at most ONE activity event
-- (status change beats assignment beats generic update for tasks).

-- --- Projects ---
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
    PERFORM public.emit_activity(
      OLD.workspace_id, NULL, v_actor, 'project', OLD.id, 'project.deleted',
      jsonb_build_object('title', OLD.name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_projects_activity ON public.projects;
CREATE TRIGGER trg_projects_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_activity();

-- --- Posts ---
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
    SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = OLD.project_id;
    PERFORM public.emit_activity(
      v_ws, OLD.project_id, v_actor, 'post', OLD.id, 'post.deleted',
      jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_posts_activity ON public.posts;
CREATE TRIGGER trg_posts_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_post_activity();

-- --- Post comments ---
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
    -- Notify the post author (never the actor themselves).
    -- Entity points at the post so the notification deep-links correctly.
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
    -- Soft-delete flips are the only comment updates worth logging
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
    SELECT pr.workspace_id, p.project_id
      INTO v_ws, v_post_project
    FROM public.posts p
    JOIN public.projects pr ON pr.id = p.project_id
    WHERE p.id = OLD.post_id;
    PERFORM public.emit_activity(
      v_ws, v_post_project, v_actor, 'comment', OLD.id, 'comment.deleted',
      jsonb_build_object('post_id', OLD.post_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_comments_activity ON public.post_comments;
CREATE TRIGGER trg_post_comments_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_comment_activity();

-- --- Tasks ---
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
      -- Completion notifies the creator (completion is implied by new DONE status)
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
    SELECT p.workspace_id INTO v_ws FROM public.projects p WHERE p.id = OLD.project_id;
    PERFORM public.emit_activity(
      v_ws, OLD.project_id, v_actor, 'task', OLD.id, 'task.deleted',
      jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_activity ON public.tasks;
CREATE TRIGGER trg_tasks_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_activity();

-- --- Chat messages (activity only; notifications come from mentions) ---
CREATE OR REPLACE FUNCTION public.log_chat_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_event UUID;
  v_scope TEXT;
BEGIN
  IF NEW.project_id IS NULL THEN
    v_scope := 'workspace';
  ELSE
    v_scope := 'project';
  END IF;
  v_event := public.emit_activity(
    NEW.workspace_id, NEW.project_id, v_actor, 'message', NEW.id, 'message.sent',
    jsonb_build_object('scope', v_scope, 'excerpt', left(NEW.content, 140)));
  PERFORM public.notify_mentioned_users(
    v_event, NEW.workspace_id, NEW.content, v_actor, NEW.project_id, 'message', NEW.id,
    'Mentioned in chat',
    left(NEW.content, 140));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_messages_activity ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_activity
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_chat_activity();

-- --- Project files ---
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
    PERFORM public.emit_activity(
      OLD.workspace_id, OLD.project_id, v_actor, 'file', OLD.id, 'file.deleted',
      jsonb_build_object('filename', OLD.original_name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_project_files_activity ON public.project_files;
CREATE TRIGGER trg_project_files_activity
  AFTER INSERT OR DELETE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.log_file_activity();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Activity: readable by workspace members/owners. No INSERT/UPDATE/DELETE
-- policies: history is append-only and server-generated.
CREATE POLICY "Activity viewable by workspace members"
  ON public.activity_events FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id) OR
    public.is_workspace_owner(workspace_id)
  );

-- Notifications: recipients read only their own. No INSERT/UPDATE/DELETE
-- policies: rows are server-generated; read state changes via RPCs below.
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. READ-STATE RPCs (narrow, recipient-guarded)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE id = p_notification_id
    AND recipient_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE recipient_id = auth.uid()
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 7. ENABLE REALTIME REPLICATION (notifications only)
-- ----------------------------------------------------------------------------
-- Activity stays poll-based: it can be high-volume (every chat message) and
-- the badge/feed requirements do not need it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
