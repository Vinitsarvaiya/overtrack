import { can } from "@/features/roles/lib/capabilities";

export type MemberRole = "owner" | "admin" | "manager" | "member" | "viewer";
export type InviteRole = "admin" | "manager" | "member" | "viewer";

export function allowedAssignableRoles(
  actorRole: MemberRole | null,
  permissions: ReturnType<typeof can>,
): InviteRole[] {
  if (actorRole === "owner") {
    return ["admin", "manager", "member", "viewer"];
  }
  if (actorRole === "admin") {
    return ["manager", "member", "viewer"];
  }
  if (actorRole === "manager") {
    return permissions.assignManagerRole ? ["manager", "member", "viewer"] : ["member", "viewer"];
  }
  return ["member", "viewer"];
}

export function canManageTargetRole(
  actorRole: MemberRole | null,
  targetRole: MemberRole,
  permissions: ReturnType<typeof can>,
) {
  if (actorRole === "owner") return targetRole !== "owner";
  if (actorRole === "admin") return targetRole !== "owner" && targetRole !== "admin";
  if (actorRole === "manager") {
    if (targetRole === "owner" || targetRole === "admin") return false;
    if (targetRole === "manager") return Boolean(permissions.assignManagerRole);
    return targetRole === "member" || targetRole === "viewer";
  }
  return false;
}
