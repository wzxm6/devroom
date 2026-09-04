-- ============================================================================
-- DevRoom Migration: 20260904000000_devroom_foundation.sql
-- Phase 1 Foundation: Profiles, Workspaces, Workspace Members, 3-Member Limit
-- ============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ----------------------------------------------------------------------------
-- 2. WORKSPACES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text || clock_timestamp()::text) from 1 for 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspaces indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_invite_code ON public.workspaces(invite_code);

-- ----------------------------------------------------------------------------
-- 3. WORKSPACE MEMBERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

-- Workspace members indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- ----------------------------------------------------------------------------
-- 4. 3-MEMBER MAXIMUM ENFORCEMENT TRIGGER
-- ----------------------------------------------------------------------------
-- Strict database-level enforcement of the 3-member limit for MVP
CREATE OR REPLACE FUNCTION public.check_workspace_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_limit CONSTANT INT := 3;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.workspace_members
  WHERE workspace_id = NEW.workspace_id;

  IF current_count >= max_limit THEN
    RAISE EXCEPTION 'Workspace member limit reached. Maximum % members allowed in DevRoom MVP.', max_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_workspace_member_limit ON public.workspace_members;
CREATE TRIGGER trg_enforce_workspace_member_limit
  BEFORE INSERT ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_workspace_member_limit();

-- ----------------------------------------------------------------------------
-- 5. PROFILE CREATION TRIGGER ON auth.users SIGNUP
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_username TEXT;
  default_display_name TEXT;
BEGIN
  default_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1),
    'Developer'
  );

  default_username := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    '[^a-zA-Z0-9_]',
    '',
    'g'
  ));

  IF default_username = '' THEN
    default_username := 'dev_' || substr(NEW.id::text, 1, 8);
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = default_username) THEN
    default_username := default_username || '_' || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    default_username,
    default_display_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. MEMBERSHIP CHECK SECURITY DEFINER HELPER (Prevents RLS Recursion)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(lookup_ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = lookup_ws_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(lookup_ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = lookup_ws_id
      AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
-- Any authenticated user can read profiles (needed for member listings and avatars)
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --- WORKSPACES POLICIES ---
-- Users can view workspaces they own or belong to
CREATE POLICY "Workspaces viewable by members or owner"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    public.is_workspace_member(id)
  );

-- Authenticated users can create workspaces
CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Only workspace owners can update their workspace
CREATE POLICY "Owners can update workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Only workspace owners can delete their workspace
CREATE POLICY "Owners can delete workspace"
  ON public.workspaces FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- --- WORKSPACE MEMBERS POLICIES ---
-- Members can view memberships in their workspaces
CREATE POLICY "Members viewable by fellow members"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_workspace_member(workspace_id)
  );

-- Users can insert membership when creating workspace or joining via valid code
CREATE POLICY "Users can join workspace or owner can add members"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

-- Users can leave workspace (delete own membership) or owner can remove members
CREATE POLICY "Users can leave or owner can remove members"
  ON public.workspace_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

-- ----------------------------------------------------------------------------
-- 8. HELPER RPC FOR JOINING WORKSPACE VIA INVITE CODE
-- ----------------------------------------------------------------------------
-- Safely looks up workspace by invite code and joins in one transaction
CREATE OR REPLACE FUNCTION public.join_workspace_by_invite(code TEXT)
RETURNS JSON AS $$
DECLARE
  target_ws RECORD;
  current_count INT;
  member_record RECORD;
BEGIN
  -- Look up workspace by invite code
  SELECT id, name, owner_id INTO target_ws
  FROM public.workspaces
  WHERE invite_code = trim(code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = target_ws.id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('success', true, 'workspace_id', target_ws.id, 'name', target_ws.name, 'message', 'Already a member');
  END IF;

  -- Enforce 3-member limit
  SELECT COUNT(*) INTO current_count
  FROM public.workspace_members
  WHERE workspace_id = target_ws.id;

  IF current_count >= 3 THEN
    RAISE EXCEPTION 'Workspace is full. Maximum 3 members allowed in DevRoom MVP.' USING ERRCODE = 'check_violation';
  END IF;

  -- Insert member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (target_ws.id, auth.uid(), 'member')
  RETURNING * INTO member_record;

  RETURN json_build_object(
    'success', true,
    'workspace_id', target_ws.id,
    'name', target_ws.name,
    'joined_at', member_record.joined_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
