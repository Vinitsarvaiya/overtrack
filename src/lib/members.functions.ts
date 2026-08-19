import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addMemberSchema,
  createWorkplaceSchema,
  memberIdSchema,
  updateMemberRatesSchema,
} from "@/lib/members.schemas";

/**
 * Adds an existing OverTrack account to a workspace.
 * Profile lookup and the insert run with elevated rights *after* the caller's
 * `users.invite` permission is verified — RLS hides profiles of non-members,
 * which is why a plain client-side insert could never work.
 */
export const addMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addMemberSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("@/lib/rbac.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPermission(context.supabase, data.workspaceId, context.userId, "users.invite");

    const { data: caller } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (caller?.role === "admin" && data.role === "admin") {
      return { ok: false as const, reason: "forbidden_role" as const };
    }

    if (caller?.role === "manager") {
      const { data: canAssignManager } = await context.supabase.rpc("has_permission", {
        _workspace_id: data.workspaceId,
        _user_id: context.userId,
        _permission: "users.assign_manager_role",
      });
      const allowedRoles = canAssignManager ? ["manager", "member", "viewer"] : ["member", "viewer"];
      if (!allowedRoles.includes(data.role)) {
        return { ok: false as const, reason: "forbidden_role" as const };
      }
    }

    const email = data.email.trim().toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!profile) {
      return { ok: false as const, reason: "not_found" as const };
    }

    const { data: existing } = await supabaseAdmin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (existing) {
      return { ok: false as const, reason: "already_member" as const };
    }

    const { error } = await supabaseAdmin.from("workspace_members").insert({
      workspace_id: data.workspaceId,
      user_id: profile.id,
      role: data.role,
      custom_role_id: data.role === "manager" ? (data.customRoleId ?? null) : null,
    });
    if (error) return { ok: false as const, reason: "failed" as const };
    return { ok: true as const };
  });

/** Revokes a member's access. Requires `users.remove`; owners cannot be removed. */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => memberIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden } = await import("@/lib/rbac.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member) throw forbidden();
    await assertPermission(context.supabase, member.workspace_id, context.userId, "users.remove");
    if (member.role === "owner") throw forbidden();

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw forbidden();
    return { ok: true };
  });

/** Creates a new workplace. Requires `workplace.create` in the current workspace. */
export const createWorkplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createWorkplaceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden } = await import("@/lib/rbac.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPermission(
      context.supabase,
      data.fromWorkspaceId,
      context.userId,
      "workplace.create",
    );

    const { data: workspace, error } = await supabaseAdmin
      .from("workspaces")
      .insert({ name: data.name, owner_id: context.userId })
      .select()
      .single();
    if (error || !workspace) throw forbidden();

    await supabaseAdmin
      .from("workspace_members")
      .insert({ workspace_id: workspace.id, user_id: context.userId, role: "owner" });
    return workspace;
  });

export const updateMemberRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateMemberRatesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission, forbidden } = await import("@/lib/rbac.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role, hourly_rate, overtime_hourly_rate")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member) throw forbidden();

    await assertPermission(
      context.supabase,
      member.workspace_id,
      context.userId,
      "money.edit_member_rates",
    );

    const { data: caller } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", member.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .select("enable_member_rates, allow_manager_rate_permissions")
      .eq("id", member.workspace_id)
      .maybeSingle();
    if (!workspace?.enable_member_rates) throw forbidden();

    if (member.role === "owner" && caller?.role !== "owner") throw forbidden();
    if (caller?.role === "admin" && member.role === "admin") throw forbidden();

    if (caller?.role === "manager") {
      if (!workspace.allow_manager_rate_permissions) throw forbidden();
      if (member.role === "owner" || member.role === "admin") throw forbidden();
      if (member.role === "manager") {
        const { data: canAssignManager } = await context.supabase.rpc("has_permission", {
          _workspace_id: member.workspace_id,
          _user_id: context.userId,
          _permission: "users.assign_manager_role",
        });
        if (!canAssignManager) throw forbidden();
      }
    }

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .update({
        hourly_rate: data.hourlyRate,
        overtime_hourly_rate: data.overtimeHourlyRate,
      })
      .eq("id", data.memberId);
    if (error) throw forbidden();

    const historyRows = [];
    if (member.hourly_rate !== data.hourlyRate) {
      historyRows.push({
        workspace_id: member.workspace_id,
        member_id: data.memberId,
        actor_id: context.userId,
        field: "hourly_rate",
        old_value: member.hourly_rate === null ? null : String(member.hourly_rate),
        new_value: data.hourlyRate === null ? null : String(data.hourlyRate),
      });
    }
    if (member.overtime_hourly_rate !== data.overtimeHourlyRate) {
      historyRows.push({
        workspace_id: member.workspace_id,
        member_id: data.memberId,
        actor_id: context.userId,
        field: "overtime_hourly_rate",
        old_value:
          member.overtime_hourly_rate === null ? null : String(member.overtime_hourly_rate),
        new_value: data.overtimeHourlyRate === null ? null : String(data.overtimeHourlyRate),
      });
    }

    if (historyRows.length > 0) {
      const { error: historyError } = await supabaseAdmin
        .from("member_rate_history")
        .insert(historyRows);
      if (historyError) throw forbidden();
    }

    return { ok: true };
  });
