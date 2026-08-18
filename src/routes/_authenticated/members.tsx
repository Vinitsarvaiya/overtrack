import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
import { can, useWorkspace } from "@/components/workspace-provider";
import { useWorkspaceMembers } from "@/lib/data";
import { useMemberMutations, useRoleMutations, useWorkspaceRoles } from "@/lib/rbac";

type MemberRole = "owner" | "admin" | "manager" | "member" | "viewer";
type InviteRole = "admin" | "manager" | "member" | "viewer";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members — OverTrack" },
      { name: "description", content: "Manage who can view, edit and approve timesheets." },
      { property: "og:title", content: "Members — OverTrack" },
      {
        property: "og:description",
        content: "Manage who can view, edit and approve timesheets.",
      },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { workspace, role, user, permissions: myPermissions } = useWorkspace();
  const { data: members = [], isLoading } = useWorkspaceMembers(workspace?.id);
  const { data: customRoles = [] } = useWorkspaceRoles(workspace?.id);
  const { assignMember } = useRoleMutations(workspace?.id);
  const { add, remove } = useMemberMutations(workspace?.id);
  const permissions = can(role, myPermissions);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState<string | null>(null);

  function addMember() {
    if (!workspace || !email.trim()) return;
    add.mutate(
      { email: email.trim(), role: inviteRole, customRoleId: inviteCustomRoleId },
      {
        onSuccess: (result) => {
          if (result.ok) {
            setEmail("");
            setInviteCustomRoleId(null);
            toast.success("Member added");
            return;
          }
          if (result.reason === "not_found") {
            toast.error("No OverTrack account found for that email — ask them to sign up first.");
          } else if (result.reason === "already_member") {
            toast.error("That person is already a member of this workspace.");
          } else {
            toast.error("Could not add that member. Please try again.");
          }
        },
        onError: () => toast.error("You do not have permission to add members"),
      },
    );
  }

  function changeRole(memberId: string, next: string, customRoleId?: string | null) {
    assignMember.mutate(
      { memberId, role: next as MemberRole, customRoleId: customRoleId ?? null },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: () => toast.error("You do not have permission to change roles"),
      },
    );
  }

  function removeMember(memberId: string) {
    remove.mutate(memberId, {
      onSuccess: () => toast.success("Access revoked"),
      onError: () => toast.error("You do not have permission to remove this member"),
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Owners and admins manage access. Members log their own time; viewers are read-only.
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
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
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
              {add.isPending ? "Adding…" : "Add"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No members yet.</p>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.profile?.full_name || member.profile?.email || "Member"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.profile?.email}</p>
                </div>
                {permissions.changeRoles && member.user_id !== user?.id ? (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(next) =>
                        changeRole(
                          member.id,
                          next,
                          next === "manager" ? (member.custom_role_id ?? customRoles[0]?.id ?? null) : null,
                        )
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="Member role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {role === "owner" ? <SelectItem value="owner">Owner</SelectItem> : null}
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    {member.role === "manager" ? (
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
                {permissions.removeMembers &&
                member.user_id !== user?.id &&
                member.role !== "owner" ? (
                  <Button variant="ghost" size="sm" onClick={() => removeMember(member.id)}>
                    Revoke
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
