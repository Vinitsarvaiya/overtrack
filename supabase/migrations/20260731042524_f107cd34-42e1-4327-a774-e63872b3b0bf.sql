CREATE OR REPLACE FUNCTION public.effective_permissions(_workspace_id uuid, _user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r app_role;
  crid uuid;
  result text[];
BEGIN
  SELECT m.role, m.custom_role_id INTO r, crid
  FROM public.workspace_members m
  WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id;

  IF r IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  IF r IN ('owner','admin') THEN
    SELECT array_agg(p.key) INTO result FROM public.permissions p;
    RETURN COALESCE(result, ARRAY[]::text[]);
  END IF;

  IF r = 'manager' THEN
    SELECT COALESCE(array_agg(rp.permission_key), ARRAY[]::text[]) INTO result
    FROM public.role_permissions rp WHERE rp.role_id = crid;
    RETURN result;
  END IF;

  IF r = 'member' THEN
    RETURN ARRAY['dashboard.view','dashboard.statistics','attendance.view','attendance.add','attendance.edit','attendance.delete','overtime.view','overtime.edit','reports.view','reports.csv','workplace.view','settings.view'];
  END IF;

  RETURN ARRAY['dashboard.view','attendance.view','overtime.view','reports.view','workplace.view','settings.view'];
END;
$$;

REVOKE EXECUTE ON FUNCTION public.effective_permissions(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_permissions(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_permission(_workspace_id uuid, _user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _permission = ANY (public.effective_permissions(_workspace_id, _user_id));
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) TO authenticated, service_role;