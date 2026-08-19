import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { can, useWorkspace } from "@/components/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MemberRateHistoryDrawer } from "@/components/member-rate-history-drawer";
import { useUpdateMemberRates, useWorkspaceMembers, type Member } from "@/lib/data";
import { formatRate } from "@/lib/calendar";
import { useMemberMutations, useRoleMutations, useWorkspaceRoles } from "@/lib/rbac";

type MemberRole = "owner" | "admin" | "manager" | "member" | "viewer";
type InviteRole = "admin" | "manager" | "member" | "viewer";

function allowedAssignableRoles(
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
    return permissions.assignManagerRole
      ? ["manager", "member", "viewer"]
      : ["member", "viewer"];
  }
  return ["member", "viewer"];
}

function canManageTargetRole(
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

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members | OverTrack" },
      { name: "description", content: "Manage who can view, edit, and approve timesheets." },
      { property: "og:title", content: "Members | OverTrack" },
      { property: "og:description", content: "Manage who can view, edit, and approve timesheets." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { workspace, role, user, permissions: myPermissions } = useWorkspace();
  const { data: members = [], isLoading } = useWorkspaceMembers(workspace?.id);
  const updateMemberRates = useUpdateMemberRates(workspace?.id);
  const { data: customRoles = [] } = useWorkspaceRoles(workspace?.id);
  const { assignMember } = useRoleMutations(workspace?.id);
  const { add, remove } = useMemberMutations(workspace?.id);
  const permissions = can(role, myPermissions, workspace);
  const inviteableRoles = useMemo(() => allowedAssignableRoles(role, permissions), [role, permissions]);
  const currency = workspace?.currency ?? "USD";
  const [historyMember, setHistoryMember] = useState<(Member & { profile: { full_name: string | null; email: string | null } | null }) | null>(null);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>(inviteableRoles[0] ?? "member");
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState<string | null>(null);
  const [rateDrafts, setRateDrafts] = useState<
    Record<string, { hourlyRate: string; overtimeHourlyRate: string }>
  >({});

  useEffect(() => {
    if (!inviteableRoles.includes(inviteRole)) {
      setInviteRole(inviteableRoles[0] ?? "member");
      setInviteCustomRoleId(null);
    }
  }, [inviteRole, inviteableRoles]);

  useEffect(() => {
    setRateDrafts((current) => {
      const next: Record<string, { hourlyRate: string; overtimeHourlyRate: string }> = {};
      for (const member of members) {
        next[member.id] = current[member.id] ?? {
          hourlyRate: member.hourly_rate === null ? "" : String(member.hourly_rate),
          overtimeHourlyRate:
            member.overtime_hourly_rate === null ? "" : String(member.overtime_hourly_rate),
        };
      }
      return next;
    });
  }, [members]);

  function editableRolesForMember(memberRole: MemberRole): MemberRole[] {
    if (role === "owner") return ["owner", "admin", "manager", "member", "viewer"];
    if (role === "admin") return ["manager", "member", "viewer"];
    if (role === "manager") {
      return permissions.assignManagerRole
        ? ["manager", "member", "viewer"]
        : ["member", "viewer"];
    }
    return [memberRole];
  }

  function addMember() {
    if (!workspace || !email.trim()) return;
    const toastId = toast.loading("Adding member...");
    add.mutate(
      { email: email.trim(), role: inviteRole, customRoleId: inviteCustomRoleId },
      {
        onSuccess: (result) => {
          if (result.ok) {
            setEmail("");
            setInviteCustomRoleId(null);
            setInviteRole(inviteableRoles[0] ?? "member");
            toast.success("Member added", { id: toastId });
            return;
          }
          if (result.reason === "not_found") {
            toast.error("No OverTrack account found for that email. Ask them to sign up first.", {
              id: toastId,
            });
          } else if (result.reason === "already_member") {
            toast.error("That person is already a member of this workspace.", { id: toastId });
          } else if (result.reason === "forbidden_role") {
            toast.error("You are not allowed to assign that role.", { id: toastId });
          } else {
            toast.error("Could not add that member. Please try again.", { id: toastId });
          }
        },
        onError: () => toast.error("You do not have permission to add members", { id: toastId }),
      },
    );
  }

  function changeRole(memberId: string, next: MemberRole, customRoleId?: string | null) {
    const toastId = toast.loading("Updating role...");
    assignMember.mutate(
      { memberId, role: next, customRoleId: customRoleId ?? null },
      {
        onSuccess: () => toast.success("Role updated", { id: toastId }),
        onError: () => toast.error("You do not have permission to change roles", { id: toastId }),
      },
    );
  }

  function removeMember(memberId: string) {
    const toastId = toast.loading("Revoking access...");
    remove.mutate(memberId, {
      onSuccess: () => toast.success("Access revoked", { id: toastId }),
      onError: () => toast.error("You do not have permission to remove this member", { id: toastId }),
    });
  }

  function setRateDraft(memberId: string, field: "hourlyRate" | "overtimeHourlyRate", value: string) {
    setRateDrafts((current) => ({
      ...current,
      [memberId]: {
        hourlyRate: current[memberId]?.hourlyRate ?? "",
        overtimeHourlyRate: current[memberId]?.overtimeHourlyRate ?? "",
        [field]: value,
      },
    }));
  }

  function saveRates(member: (typeof members)[number]) {
    const draft = rateDrafts[member.id] ?? { hourlyRate: "", overtimeHourlyRate: "" };
    const hourlyRate = draft.hourlyRate.trim() === "" ? null : Number(draft.hourlyRate);
    const overtimeHourlyRate =
      draft.overtimeHourlyRate.trim() === "" ? null : Number(draft.overtimeHourlyRate);

    if (
      (hourlyRate !== null && Number.isNaN(hourlyRate)) ||
      (overtimeHourlyRate !== null && Number.isNaN(overtimeHourlyRate))
    ) {
      toast.error("Enter valid rates before saving");
      return;
    }

    const toastId = toast.loading("Saving rates...");
    updateMemberRates.mutate(
      { memberId: member.id, hourlyRate, overtimeHourlyRate },
      {
        onSuccess: () => toast.success("Rates updated", { id: toastId }),
        onError: () => toast.error("Could not update member rates", { id: toastId }),
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Owners and admins manage access. Managers can work within their granted role limits.
          Members log their own time; viewers are read-only.
        </p>
      </div>

      {permissions.inviteMembers ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a member</CardTitle>
            <CardDescription>Share this workspace with a teammate by email.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              type="email"
              aria-label="Teammate email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Select
              value={inviteRole}
              onValueChange={(value) => {
                setInviteRole(value as InviteRole);
                if (value !== "manager") setInviteCustomRoleId(null);
              }}
            >
              <SelectTrigger className="w-36" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inviteableRoles.includes("admin") ? <SelectItem value="admin">Admin</SelectItem> : null}
                {inviteableRoles.includes("manager") ? (
                  <SelectItem value="manager">Manager</SelectItem>
                ) : null}
                {inviteableRoles.includes("member") ? (
                  <SelectItem value="member">Member</SelectItem>
                ) : null}
                {inviteableRoles.includes("viewer") ? (
                  <SelectItem value="viewer">Viewer</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            {inviteRole === "manager" ? (
              <Select
                value={inviteCustomRoleId ?? ""}
                onValueChange={(roleId) => setInviteCustomRoleId(roleId)}
              >
                <SelectTrigger className="w-44" aria-label="Manager permission set">
                  <SelectValue placeholder="No permissions" />
                </SelectTrigger>
                <SelectContent>
                  {customRoles.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Create a role first
                    </SelectItem>
                  ) : (
                    customRoles.map((customRole) => (
                      <SelectItem key={customRole.id} value={customRole.id}>
                        {customRole.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : null}
            <Button onClick={addMember} disabled={add.isPending || !email.trim()}>
              {add.isPending ? "Adding..." : "Add"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No members yet.</p>
          ) : (
            members.map((member) => {
              const allowedRoles = editableRolesForMember(member.role);
              const canEditThisMember =
                permissions.changeRoles &&
                member.user_id !== user?.id &&
                canManageTargetRole(role, member.role, permissions) &&
                allowedRoles.length > 0;
              const canRemoveThisMember =
                permissions.removeMembers &&
                member.user_id !== user?.id &&
                canManageTargetRole(role, member.role, permissions);
              const canViewRates =
                permissions.viewMemberRates &&
                member.user_id !== user?.id &&
                canManageTargetRole(role, member.role, permissions);
              const canEditRates =
                permissions.editMemberRates &&
                member.user_id !== user?.id &&
                canManageTargetRole(role, member.role, permissions);
              const rateDraft = rateDrafts[member.id] ?? {
                hourlyRate: member.hourly_rate === null ? "" : String(member.hourly_rate),
                overtimeHourlyRate:
                  member.overtime_hourly_rate === null ? "" : String(member.overtime_hourly_rate),
              };
              const hasRateChanges =
                rateDraft.hourlyRate !== (member.hourly_rate === null ? "" : String(member.hourly_rate)) ||
                rateDraft.overtimeHourlyRate !==
                  (member.overtime_hourly_rate === null ? "" : String(member.overtime_hourly_rate));
              return (
                <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.profile?.full_name || member.profile?.email || "Member"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.profile?.email}</p>
                  </div>
                  {canEditThisMember ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(next) =>
                          changeRole(
                            member.id,
                            next as MemberRole,
                            next === "manager"
                              ? (member.custom_role_id ?? customRoles[0]?.id ?? null)
                              : null,
                          )
                        }
                      >
                        <SelectTrigger className="w-32" aria-label="Member role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedRoles.includes("owner") ? <SelectItem value="owner">Owner</SelectItem> : null}
                          {allowedRoles.includes("admin") ? <SelectItem value="admin">Admin</SelectItem> : null}
                          {allowedRoles.includes("manager") ? (
                            <SelectItem value="manager">Manager</SelectItem>
                          ) : null}
                          {allowedRoles.includes("member") ? (
                            <SelectItem value="member">Member</SelectItem>
                          ) : null}
                          {allowedRoles.includes("viewer") ? (
                            <SelectItem value="viewer">Viewer</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                      {member.role === "manager" && allowedRoles.includes("manager") ? (
                        <Select
                          value={member.custom_role_id ?? ""}
                          onValueChange={(roleId) => changeRole(member.id, "manager", roleId)}
                        >
                          <SelectTrigger className="w-44" aria-label="Manager permission set">
                            <SelectValue placeholder="No permissions" />
                          </SelectTrigger>
                          <SelectContent>
                            {customRoles.length === 0 ? (
                              <SelectItem value="none" disabled>
                                Create a role first
                              </SelectItem>
                            ) : (
                              customRoles.map((customRole) => (
                                <SelectItem key={customRole.id} value={customRole.id}>
                                  {customRole.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </>
                  ) : (
                    <Badge variant="secondary">{member.role}</Badge>
                  )}
                  {canRemoveThisMember ? (
                    <Button variant="ghost" size="sm" onClick={() => removeMember(member.id)}>
                      Revoke
                    </Button>
                  ) : null}
                  {canViewRates ? (
                    <div className="grid w-full gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Normal hourly rate</Label>
                        {canEditRates ? (
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="pr-3 tabular-nums"
                            placeholder={`Default: ${workspace?.hourly_rate ?? 0}`}
                            value={rateDraft.hourlyRate}
                            onChange={(event) =>
                              setRateDraft(member.id, "hourlyRate", event.target.value)
                            }
                          />
                        ) : (
                          <p className="text-sm font-medium tabular-nums">
                            {member.hourly_rate === null
                              ? `Default: ${formatRate(Number(workspace?.hourly_rate ?? 0), currency)}`
                              : formatRate(Number(member.hourly_rate), currency)}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Overtime hourly rate</Label>
                        {canEditRates ? (
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="pr-3 tabular-nums"
                            placeholder={`Default: ${workspace?.overtime_hourly_rate ?? 0}`}
                            value={rateDraft.overtimeHourlyRate}
                            onChange={(event) =>
                              setRateDraft(member.id, "overtimeHourlyRate", event.target.value)
                            }
                          />
                        ) : (
                          <p className="text-sm font-medium tabular-nums">
                            {member.overtime_hourly_rate === null
                              ? `Default: ${formatRate(Number(workspace?.overtime_hourly_rate ?? 0), currency)}`
                              : formatRate(Number(member.overtime_hourly_rate), currency)}
                          </p>
                        )}
                      </div>
                      {canEditRates ? (
                        <div className="flex items-end lg:justify-end">
                          <div className="flex w-full gap-2 lg:w-auto">
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full lg:w-auto"
                              onClick={() => setHistoryMember(member)}
                            >
                              History
                            </Button>
                            <Button
                              className="w-full lg:w-auto"
                              onClick={() => saveRates(member)}
                              disabled={updateMemberRates.isPending || !hasRateChanges}
                            >
                              Save rates
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-end lg:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full lg:w-auto"
                            onClick={() => setHistoryMember(member)}
                          >
                            History
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <MemberRateHistoryDrawer
        member={historyMember}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setHistoryMember(null);
        }}
        nameFor={(userId) =>
          members.find((member) => member.user_id === userId)?.profile?.full_name ||
          members.find((member) => member.user_id === userId)?.profile?.email ||
          "Member"
        }
      />
    </div>
  );
}
