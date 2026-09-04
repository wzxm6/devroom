-- ============================================================================
-- DevRoom Migration: 20260904020000_devroom_posts.sql
-- Phase 3: Project Posts, Threaded Comments, Triggers, RLS, and Realtime
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HELPER SECURITY DEFINER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_member(lookup_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = lookup_project_id
      AND (
        public.is_workspace_member(p.workspace_id) OR
        public.is_workspace_owner(p.workspace_id)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_post_member(lookup_post_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = lookup_post_id
      AND public.is_project_member(p.project_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 2. POSTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts Indexes
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON public.posts(project_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. POST COMMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  -- Prepared for Phase 2 image annotation comments
  attachment_id UUID NULL,
  x_position FLOAT NULL,
  y_position FLOAT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post Comments Indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author_id ON public.post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON public.post_comments(created_at ASC);

-- ----------------------------------------------------------------------------
-- 4. AUTOMATIC updated_at TRIGGERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_post_comments_updated_at ON public.post_comments;
CREATE TRIGGER trg_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- --- POSTS POLICIES ---
-- SELECT: Users can view posts in projects they belong to
CREATE POLICY "Posts viewable by project members"
  ON public.posts FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

-- INSERT: Project members can create posts with their own author_id
CREATE POLICY "Project members can create posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    public.is_project_member(project_id)
  );

-- UPDATE: Authors can update their own posts
CREATE POLICY "Authors can update own posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid() AND
    public.is_project_member(project_id)
  )
  WITH CHECK (
    author_id = auth.uid() AND
    public.is_project_member(project_id)
  );

-- DELETE: Authors or workspace owners can delete posts
CREATE POLICY "Authors or owners can delete posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.is_workspace_owner(p.workspace_id)
    )
  );

-- --- POST COMMENTS POLICIES ---
-- SELECT: Members of the post's project can view comments
CREATE POLICY "Comments viewable by post members"
  ON public.post_comments FOR SELECT
  TO authenticated
  USING (public.is_post_member(post_id));

-- INSERT: Members of the post's project can insert comments
CREATE POLICY "Post members can create comments"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    public.is_post_member(post_id)
  );

-- UPDATE: Authors can update their own comments
CREATE POLICY "Authors can update own comments"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid() AND
    public.is_post_member(post_id)
  )
  WITH CHECK (
    author_id = auth.uid() AND
    public.is_post_member(post_id)
  );

-- DELETE: Authors or workspace owners can delete comments
CREATE POLICY "Authors or owners can delete comments"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.projects pr ON pr.id = p.project_id
      WHERE p.id = post_id
        AND public.is_workspace_owner(pr.workspace_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 6. ENABLE REALTIME REPLICATION
-- ----------------------------------------------------------------------------
-- Add posts and post_comments to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  END IF;
END $$;
