-- ============================================================================
-- DevRoom RLS negative tests (STAGING ONLY — never production)
--
-- How to run:
--   1. Apply migrations 1-8 + hardening migration to a staging project.
--   2. Create two users (A and B) in SEPARATE workspaces, each owning one
--      workspace with one project. Note their auth user UUIDs.
--   3. Replace the :USER_A / :USER_B / :WS_B / :PROJECT_B placeholders below
--      (psql \set) or paste literal UUIDs.
--   4. Run the whole script in the SQL editor. Every check prints PASS/FAIL
--      via RAISE NOTICE. Any FAIL means an isolation regression.
--
-- Technique: impersonate an authenticated user by setting the JWT claims that
-- auth.uid() reads, then SET ROLE authenticated so RLS applies exactly as it
-- does for the browser client. Each write attempt runs past a SAVEPOINT so an
-- expected denial does not abort the script.
--
-- STATUS: written for staging; NOT executed (no staging credentials exist in
-- this environment). Do not mark these green until run output is attached.
-- ============================================================================

-- psql placeholders (SQL editor: replace with literals):
-- :USER_A = auth UUID of a user in workspace A
-- :USER_B = auth UUID of a user in workspace B
-- :WS_B = workspace B id | :PROJECT_B = project in workspace B
-- :TASK_B = task id owned by B's project (for update/delete attempts)

BEGIN;

CREATE TEMPORARY TABLE rls_results (name TEXT, passed BOOLEAN);
-- Temp objects belong to the login role; grant access before impersonating.
GRANT ALL ON rls_results TO authenticated;

-- Impersonate user A for the rest of this transaction. From here on, RLS
-- applies exactly as it does for the browser client.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'USER_A', 'role', 'authenticated')::text,
  true
);
SET ROLE authenticated;

INSERT INTO rls_results
SELECT 'A cannot select B projects', count(*) = 0 FROM public.projects WHERE workspace_id = :'WS_B'::uuid;
INSERT INTO rls_results
SELECT 'A cannot select B tasks', count(*) = 0
FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE p.workspace_id = :'WS_B'::uuid;
INSERT INTO rls_results
SELECT 'A cannot select B posts', count(*) = 0
FROM public.posts p JOIN public.projects pr ON pr.id = p.project_id WHERE pr.workspace_id = :'WS_B'::uuid;
INSERT INTO rls_results
SELECT 'A cannot select B chat', count(*) = 0 FROM public.chat_messages WHERE workspace_id = :'WS_B'::uuid;
INSERT INTO rls_results
SELECT 'A cannot select B files', count(*) = 0 FROM public.project_files WHERE workspace_id = :'WS_B'::uuid;
INSERT INTO rls_results
SELECT 'A cannot select B activity', count(*) = 0 FROM public.activity_events WHERE workspace_id = :'WS_B'::uuid;
INSERT INTO rls_results
SELECT 'A cannot select B notifications', count(*) = 0 FROM public.notifications WHERE workspace_id = :'WS_B'::uuid;
INSERT INTO rls_results
SELECT 'A cannot select B storage objects', count(*) = 0
FROM storage.objects WHERE bucket_id = 'project-files' AND name LIKE :'WS_B' || '/%';

-- ----------------------------------------------------------------------------
-- 2. Write isolation + identity spoofing (each attempt must be denied)
-- ----------------------------------------------------------------------------

-- 2a. Task in B's project
SAVEPOINT w1;
DO $$
BEGIN
  INSERT INTO public.tasks (project_id, title, created_by)
  VALUES (:'PROJECT_B'::uuid, 'evil', :'USER_A'::uuid);
  INSERT INTO rls_results VALUES ('A cannot create tasks in B project', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rls_results VALUES ('A cannot create tasks in B project', true);
END $$;
ROLLBACK TO SAVEPOINT w1;

-- 2b. author_id spoofing (B as author, own project would be needed; use B project → denied regardless)
SAVEPOINT w2;
DO $$
BEGIN
  INSERT INTO public.posts (project_id, author_id, title, content)
  VALUES (:'PROJECT_B'::uuid, :'USER_B'::uuid, 'evil', 'evil');
  INSERT INTO rls_results VALUES ('A cannot spoof author_id', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rls_results VALUES ('A cannot spoof author_id', true);
END $$;
ROLLBACK TO SAVEPOINT w2;

-- 2c. Cross-workspace project/task move (hardening trigger)
SAVEPOINT w3;
DO $$
DECLARE v_task UUID;
BEGIN
  SELECT id INTO v_task FROM public.tasks WHERE created_by = :'USER_A'::uuid LIMIT 1;
  UPDATE public.tasks SET project_id = :'PROJECT_B'::uuid WHERE id = v_task;
  INSERT INTO rls_results VALUES ('A cannot move tasks into B project', false);
EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
  INSERT INTO rls_results VALUES ('A cannot move tasks into B project', true);
END $$;
ROLLBACK TO SAVEPOINT w3;

-- 2d. Self-join B without invite code (hardening policy)
SAVEPOINT w4;
DO $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (:'WS_B'::uuid, :'USER_A'::uuid, 'member');
  INSERT INTO rls_results VALUES ('A cannot self-join B without invite', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rls_results VALUES ('A cannot self-join B without invite', true);
END $$;
ROLLBACK TO SAVEPOINT w4;

-- 2e. Forge activity / notification rows
SAVEPOINT w5;
DO $$
BEGIN
  INSERT INTO public.activity_events (workspace_id, action, entity_type)
  VALUES (:'WS_B'::uuid, 'project.deleted', 'project');
  INSERT INTO rls_results VALUES ('A cannot forge activity', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rls_results VALUES ('A cannot forge activity', true);
END $$;
ROLLBACK TO SAVEPOINT w5;

SAVEPOINT w6;
DO $$
BEGIN
  INSERT INTO public.notifications (recipient_id, workspace_id, notification_type, title)
  VALUES (:'USER_A'::uuid, :'WS_B'::uuid, 'mention', 'fake');
  INSERT INTO rls_results VALUES ('A cannot forge notifications', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rls_results VALUES ('A cannot forge notifications', true);
END $$;
ROLLBACK TO SAVEPOINT w6;

-- 2f. Edit / delete B's task
SAVEPOINT w7;
DO $$
BEGIN
  UPDATE public.tasks SET title = 'evil' WHERE id = :'TASK_B'::uuid;
  IF FOUND THEN
    INSERT INTO rls_results VALUES ('A cannot edit B task (0 rows)', false);
  ELSE
    INSERT INTO rls_results VALUES ('A cannot edit B task (0 rows)', true);
  END IF;
END $$;
ROLLBACK TO SAVEPOINT w7;

-- ----------------------------------------------------------------------------
-- 3. Report
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  failures INT := 0;
BEGIN
  FOR r IN SELECT * FROM rls_results LOOP
    IF r.passed THEN
      RAISE NOTICE 'PASS: %', r.name;
    ELSE
      RAISE NOTICE 'FAIL: %', r.name;
      failures := failures + 1;
    END IF;
  END LOOP;
  IF failures > 0 THEN
    RAISE EXCEPTION '% RLS NEGATIVE TEST(S) FAILED', failures;
  ELSE
    RAISE NOTICE 'ALL RLS NEGATIVE TESTS PASSED';
  END IF;
END $$;

ROLLBACK;
