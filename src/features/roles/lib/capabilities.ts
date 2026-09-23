import type { Tables } from "@/integrations/supabase/types";
import type { Workspace } from "@/features/workspaces/types";
type Role = Tables<"workspace_members">["role"];

/**
 * Role capability helpers shared by every screen.
 * Managers have no fixed rights — their capabilities come from granted permissions.
 */
export function can(
  role: Role | null,
  permissions: string[] = [],
  workspace: Workspace | null = null,
) {
  const fixedAdmin = role === "owner" || role === "admin";
  const isManager = role === "manager";
  const granted = (key: string) => fixedAdmin || (isManager && permissions.includes(key));
  const inviteMembers = granted("users.invite");
  const removeMembers = granted("users.remove");
  const changeRoles = granted("users.change_role");
  const assignManagerRole = granted("users.assign_manager_role");
  const managerRatesAllowed = workspace?.allow_manager_rate_permissions === true;
  const memberRatesEnabled = workspace?.enable_member_rates !== false;
  const viewMemberRates =
    memberRatesEnabled &&
    (fixedAdmin ||
      (isManager && managerRatesAllowed && permissions.includes("money.view_member_rates")));
  const editMemberRates =
    memberRatesEnabled &&
    (fixedAdmin ||
      (isManager && managerRatesAllowed && permissions.includes("money.edit_member_rates")));
  return {
    edit:
      fixedAdmin || role === "member" || granted("attendance.add") || granted("attendance.edit"),
    manageAll: granted("attendance.edit"),
    approve: granted("overtime.approve"),
    reject: granted("overtime.reject"),
    inviteMembers,
    removeMembers,
    changeRoles,
    assignManagerRole,
    viewMemberRates,
    editMemberRates,
    /** Any member-management capability at all — drives navigation visibility. */
    manageMembers: inviteMembers || removeMembers || changeRoles,
    manageRoles: fixedAdmin,
    createWorkplace: granted("workplace.create"),
    viewHistory: granted("dashboard.analytics"),
    editSettings: granted("settings.edit"),
  };
}
