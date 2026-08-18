/**
 * Server-only permission guards. Every mutating server function must call
 * `assertPermission` before touching data — the UI only hides controls.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}

export async function assertPermission(
  supabase: Client,
  workspaceId: string,
  userId: string,
  permission: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_permission", {
    _workspace_id: workspaceId,
    _user_id: userId,
    _permission: permission,
  });
  if (error || data !== true) throw forbidden();
}

/** Resolves the workspace a custom role belongs to, or 403 when unreachable. */
export async function workspaceOfRole(supabase: Client, roleId: string): Promise<string> {
  const { data, error } = await supabase
    .from("workspace_roles")
    .select("workspace_id")
    .eq("id", roleId)
    .maybeSingle();
  if (error || !data) throw forbidden();
  return data.workspace_id;
}
