ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS enable_member_rates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_manager_rate_permissions boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.member_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  actor_id uuid,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.member_rate_history TO authenticated;
GRANT ALL ON public.member_rate_history TO service_role;
ALTER TABLE public.member_rate_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read member rate history" ON public.member_rate_history;
CREATE POLICY "Read member rate history"
  ON public.member_rate_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = member_rate_history.workspace_id
        AND w.enable_member_rates = true
        AND (
          public.workspace_role(member_rate_history.workspace_id, auth.uid()) IN ('owner','admin')
          OR (
            w.allow_manager_rate_permissions = true
            AND public.has_permission(
              member_rate_history.workspace_id,
              auth.uid(),
              'money.view_member_rates'
            )
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS member_rate_history_member_idx
  ON public.member_rate_history (member_id, created_at DESC);
