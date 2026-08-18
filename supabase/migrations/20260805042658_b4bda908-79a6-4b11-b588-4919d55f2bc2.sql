ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS enable_standard_hours boolean NOT NULL DEFAULT true;

CREATE TABLE public.workspace_calendar_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  day_type text NOT NULL DEFAULT 'holiday' CHECK (day_type IN ('holiday','half_day','custom','working')),
  hours numeric,
  label text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, day_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_calendar_days TO authenticated;
GRANT ALL ON public.workspace_calendar_days TO service_role;

ALTER TABLE public.workspace_calendar_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_days_select ON public.workspace_calendar_days
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY calendar_days_insert ON public.workspace_calendar_days
  FOR INSERT TO authenticated
  WITH CHECK (
    public.workspace_role(workspace_id, auth.uid()) = ANY (ARRAY['owner'::app_role,'admin'::app_role])
    OR public.has_permission(workspace_id, auth.uid(), 'settings.edit')
  );

CREATE POLICY calendar_days_update ON public.workspace_calendar_days
  FOR UPDATE TO authenticated
  USING (
    public.workspace_role(workspace_id, auth.uid()) = ANY (ARRAY['owner'::app_role,'admin'::app_role])
    OR public.has_permission(workspace_id, auth.uid(), 'settings.edit')
  )
  WITH CHECK (
    public.workspace_role(workspace_id, auth.uid()) = ANY (ARRAY['owner'::app_role,'admin'::app_role])
    OR public.has_permission(workspace_id, auth.uid(), 'settings.edit')
  );

CREATE POLICY calendar_days_delete ON public.workspace_calendar_days
  FOR DELETE TO authenticated
  USING (
    public.workspace_role(workspace_id, auth.uid()) = ANY (ARRAY['owner'::app_role,'admin'::app_role])
    OR public.has_permission(workspace_id, auth.uid(), 'settings.edit')
  );

CREATE TRIGGER workspace_calendar_days_updated_at
  BEFORE UPDATE ON public.workspace_calendar_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();