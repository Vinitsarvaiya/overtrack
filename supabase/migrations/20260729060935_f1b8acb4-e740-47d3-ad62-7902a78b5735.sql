
CREATE TYPE public.app_role AS ENUM ('owner','admin','member','viewer');
CREATE TYPE public.entry_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  company text,
  timezone text NOT NULL DEFAULT 'UTC',
  standard_daily_hours numeric(5,2) NOT NULL DEFAULT 8,
  default_break_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  timezone text NOT NULL DEFAULT 'UTC',
  standard_daily_hours numeric(5,2) NOT NULL DEFAULT 8,
  default_break_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.overtime_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Development',
  notes text,
  status public.entry_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX overtime_entries_ws_date_idx ON public.overtime_entries (workspace_id, entry_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_entries TO authenticated;
GRANT ALL ON public.overtime_entries TO service_role;
ALTER TABLE public.overtime_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(_workspace_id uuid, _user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.workspace_members m WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.shares_workspace(_user_id uuid, _other_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members a
    JOIN public.workspace_members b ON a.workspace_id = b.workspace_id
    WHERE a.user_id = _user_id AND b.user_id = _other_user_id
  );
$$;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_workspace(auth.uid(), id));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(id, auth.uid()));
CREATE POLICY "workspaces_insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces_update" ON public.workspaces FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.workspace_role(id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (owner_id = auth.uid() OR public.workspace_role(id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "workspaces_delete" ON public.workspaces FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "members_select" ON public.workspace_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members_insert" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
  );
CREATE POLICY "members_update" ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "members_delete" ON public.workspace_members FOR DELETE TO authenticated
  USING (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin') OR user_id = auth.uid());

CREATE POLICY "entries_select" ON public.overtime_entries FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "entries_insert" ON public.overtime_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin','member')
    AND (user_id = auth.uid() OR public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'))
  );
CREATE POLICY "entries_update" ON public.overtime_entries FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin','member'))
    OR public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
  )
  WITH CHECK (
    (user_id = auth.uid() AND public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin','member'))
    OR public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
  );
CREATE POLICY "entries_delete" ON public.overtime_entries FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin','member'))
    OR public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
  );

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER entries_updated_at BEFORE UPDATE ON public.overtime_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
