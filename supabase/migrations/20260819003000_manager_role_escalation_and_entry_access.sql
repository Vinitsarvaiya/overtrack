INSERT INTO public.permissions (key, category, label, sort_order)
VALUES ('users.assign_manager_role', 'User Management', 'Assign Manager Role', 50)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "entries_insert" ON public.overtime_entries;
CREATE POLICY "entries_insert" ON public.overtime_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid())
    AND (
      public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
      OR public.has_permission(workspace_id, auth.uid(), 'attendance.edit')
      OR (
        user_id = auth.uid()
        AND public.has_permission(workspace_id, auth.uid(), 'attendance.add')
      )
    )
  );

DROP POLICY IF EXISTS "entries_update" ON public.overtime_entries;
CREATE POLICY "entries_update" ON public.overtime_entries FOR UPDATE TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
    AND (
      public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
      OR public.has_permission(workspace_id, auth.uid(), 'attendance.edit')
      OR (
        user_id = auth.uid()
        AND public.has_permission(workspace_id, auth.uid(), 'attendance.edit')
      )
    )
  )
  WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid())
    AND (
      public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
      OR public.has_permission(workspace_id, auth.uid(), 'attendance.edit')
      OR (
        user_id = auth.uid()
        AND public.has_permission(workspace_id, auth.uid(), 'attendance.edit')
      )
    )
  );

DROP POLICY IF EXISTS "entries_delete" ON public.overtime_entries;
CREATE POLICY "entries_delete" ON public.overtime_entries FOR DELETE TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
    AND (
      public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
      OR public.has_permission(workspace_id, auth.uid(), 'attendance.edit')
      OR (
        user_id = auth.uid()
        AND public.has_permission(workspace_id, auth.uid(), 'attendance.delete')
      )
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_entry_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r app_role;
BEGIN
  IF COALESCE(OLD.locked, false) THEN
    SELECT public.workspace_role(OLD.workspace_id, auth.uid()) INTO r;
    IF r IS NULL THEN
      RAISE EXCEPTION 'This entry is locked after approval' USING ERRCODE = 'check_violation';
    END IF;

    IF r IN ('owner','admin') THEN
      RETURN NEW;
    END IF;

    IF public.has_permission(OLD.workspace_id, auth.uid(), 'attendance.edit') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'This entry is locked after approval' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
