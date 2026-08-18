
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_workspace(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_workspace(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
