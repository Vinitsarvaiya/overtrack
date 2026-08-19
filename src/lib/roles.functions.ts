import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assignMemberRoleSchema,
  createRoleSchema,
  duplicateRoleSchema,
  renameRoleSchema,
  roleIdSchema,
  togglePermissionSchema,
} from "@/lib/roles.schemas";

/** Permissions the signed-in user actually has in a workspace. */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("effective_permissions", {
      _workspace_id: data.workspaceId,
      _user_id: context.userId,
    });
    if (error) return [] as string[];
    return (rows ?? []) as string[];
  });

export const createRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden } = await import("@/lib/rbac.server");
    await assertPermission(context.supabase, data.workspaceId, context.userId, "settings.edit");
    const { data: row, error } = await context.supabase
      .from("workspace_roles")
      .insert({
        workspace_id: data.workspaceId,
        name: data.name,
        description: data.description ?? null,
      })
      .select()
      .single();
    if (error || !row) throw forbidden();
    return row;
  });

export const renameRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => renameRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden, workspaceOfRole } = await import("@/lib/rbac.server");
    const workspaceId = await workspaceOfRole(context.supabase, data.roleId);
    await assertPermission(context.supabase, workspaceId, context.userId, "settings.edit");
    const { error } = await context.supabase
      .from("workspace_roles")
      .update({ name: data.name, description: data.description ?? null })
      .eq("id", data.roleId);
    if (error) throw forbidden();
    return { ok: true };
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => roleIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden, workspaceOfRole } = await import("@/lib/rbac.server");
    const workspaceId = await workspaceOfRole(context.supabase, data.roleId);
    await assertPermission(context.supabase, workspaceId, context.userId, "settings.edit");
    const { error } = await context.supabase
      .from("workspace_roles")
      .delete()
      .eq("id", data.roleId);
    if (error) throw forbidden();
    return { ok: true };
  });

export const duplicateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => duplicateRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden, workspaceOfRole } = await import("@/lib/rbac.server");
    const workspaceId = await workspaceOfRole(context.supabase, data.roleId);
    await assertPermission(context.supabase, workspaceId, context.userId, "settings.edit");

    const { data: source } = await context.supabase
      .from("workspace_roles")
      .select("description")
      .eq("id", data.roleId)
      .maybeSingle();
    const { data: copy, error } = await context.supabase
      .from("workspace_roles")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        description: source?.description ?? null,
      })
      .select()
      .single();
    if (error || !copy) throw forbidden();

    const { data: perms } = await context.supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_id", data.roleId);
    if (perms && perms.length > 0) {
      await context.supabase
        .from("role_permissions")
        .insert(perms.map((p) => ({ role_id: copy.id, permission_key: p.permission_key })));
    }
    return copy;
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => togglePermissionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden, workspaceOfRole } = await import("@/lib/rbac.server");
    const workspaceId = await workspaceOfRole(context.supabase, data.roleId);
    await assertPermission(context.supabase, workspaceId, context.userId, "settings.edit");

    if (data.enabled) {
      const { error } = await context.supabase
        .from("role_permissions")
        .upsert(
          { role_id: data.roleId, permission_key: data.permissionKey },
          { onConflict: "role_id,permission_key" },
        );
      if (error) throw forbidden();
    } else {
      const { error } = await context.supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", data.roleId)
        .eq("permission_key", data.permissionKey);
      if (error) throw forbidden();
    }
    return { ok: true };
  });

export const assignMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => assignMemberRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden } = await import("@/lib/rbac.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member) throw forbidden();
    await assertPermission(context.supabase, member.workspace_id, context.userId, "users.change_role");

    const { data: caller } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", member.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    // Only an owner may grant or revoke ownership.
    if (data.role === "owner" || member.role === "owner") {
      if (caller?.role !== "owner") throw forbidden();
    }

    if (caller?.role === "admin" && (data.role === "admin" || member.role === "admin")) {
      throw forbidden();
    }

    if (caller?.role === "manager") {
      if (data.role === "admin" || data.role === "owner") throw forbidden();
      const { data: canAssignManager } = await context.supabase.rpc("has_permission", {
        _workspace_id: member.workspace_id,
        _user_id: context.userId,
        _permission: "users.assign_manager_role",
      });
      if (data.role === "manager" && !canAssignManager) throw forbidden();
    }

    // Elevated write: RLS restricts member updates to owners/admins, but a
    // manager holding `users.change_role` is authorised by the check above.
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .update({
        role: data.role,
        custom_role_id: data.role === "manager" ? (data.customRoleId ?? null) : null,
      })
      .eq("id", data.memberId);
    if (error) throw forbidden();
    return { ok: true };
  });
