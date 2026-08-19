import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { PermissionRow } from "@/lib/permissions";
import { addMember, createWorkplace, removeMember } from "@/lib/members.functions";
import type { Member, Profile } from "@/lib/data";
import {
  assignMemberRole,
  createRole,
  deleteRole,
  duplicateRole,
  getMyPermissions,
  renameRole,
  setRolePermission,
} from "@/lib/roles.functions";

export type WorkspaceRole = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type WorkspaceMemberWithProfile = Member & { profile: Profile | null };

/** Full permission catalog (read-only reference data). */
export function usePermissionCatalog() {
  return useQuery({
    queryKey: ["permission-catalog"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<PermissionRow[]> => {
      const { data, error } = await supabase
        .from("permissions")
        .select("key, category, label, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Custom manager roles defined in a workspace. */
export function useWorkspaceRoles(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-roles", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<WorkspaceRole[]> => {
      const { data, error } = await supabase
        .from("workspace_roles")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Map of role id → granted permission keys. */
export function useRolePermissions(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["role-permissions", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data: roles, error: roleError } = await supabase
        .from("workspace_roles")
        .select("id")
        .eq("workspace_id", workspaceId!);
      if (roleError) throw roleError;
      const ids = (roles ?? []).map((role) => role.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role_id, permission_key")
        .in("role_id", ids);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        map[row.role_id] = [...(map[row.role_id] ?? []), row.permission_key];
      }
      return map;
    },
  });
}

/** Permissions the signed-in user has, resolved server-side. */
export function useMyPermissions(workspaceId: string | undefined) {
  const fetchPermissions = useServerFn(getMyPermissions);
  return useQuery({
    queryKey: ["my-permissions", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => fetchPermissions({ data: { workspaceId: workspaceId! } }),
  });
}

function useRoleInvalidation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["role-permissions", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["my-permissions", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] }),
    ]);
  };
}

export function useRoleMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = useRoleInvalidation(workspaceId);
  const create = useServerFn(createRole);
  const rename = useServerFn(renameRole);
  const remove = useServerFn(deleteRole);
  const copy = useServerFn(duplicateRole);
  const toggle = useServerFn(setRolePermission);
  const assign = useServerFn(assignMemberRole);

  return {
    create: useMutation({
      mutationFn: (input: { name: string; description?: string | null }) =>
        create({ data: { workspaceId: workspaceId!, ...input } }),
      onSuccess: invalidate,
    }),
    rename: useMutation({
      mutationFn: (input: { roleId: string; name: string; description?: string | null }) =>
        rename({ data: input }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (roleId: string) => remove({ data: { roleId } }),
      onSuccess: invalidate,
    }),
    duplicate: useMutation({
      mutationFn: (input: { roleId: string; name: string }) => copy({ data: input }),
      onSuccess: invalidate,
    }),
    toggle: useMutation({
      mutationKey: ["toggle-role-permission", workspaceId],
      mutationFn: (input: { roleId: string; permissionKey: string; enabled: boolean }) =>
        toggle({ data: input }),
      onMutate: async (input) => {
        const queryKey = ["role-permissions", workspaceId] as const;
        await queryClient.cancelQueries({ queryKey });
        const previousPermissions =
          queryClient.getQueryData<Record<string, string[]>>(queryKey);

        if (previousPermissions) {
          const current = previousPermissions[input.roleId] ?? [];
          const next = input.enabled
            ? Array.from(new Set([...current, input.permissionKey]))
            : current.filter((key) => key !== input.permissionKey);

          queryClient.setQueryData<Record<string, string[]>>(queryKey, {
            ...previousPermissions,
            [input.roleId]: next,
          });
        }

        return { previousPermissions };
      },
      onError: (_error, _input, context) => {
        if (context?.previousPermissions) {
          queryClient.setQueryData(["role-permissions", workspaceId], context.previousPermissions);
        }
      },
      onSettled: async () => {
        const stillMutating = queryClient.isMutating({
          mutationKey: ["toggle-role-permission", workspaceId],
        });
        if (stillMutating === 1) {
          await invalidate();
        }
      },
    }),
    assignMember: useMutation({
      mutationFn: (input: {
        memberId: string;
        role: "owner" | "admin" | "manager" | "member" | "viewer";
        customRoleId?: string | null;
      }) => assign({ data: input }),
      onMutate: async (input) => {
        const queryKey = ["members", workspaceId] as const;
        await queryClient.cancelQueries({ queryKey });
        const previousMembers = queryClient.getQueryData<WorkspaceMemberWithProfile[]>(queryKey);
        if (previousMembers) {
          queryClient.setQueryData<WorkspaceMemberWithProfile[]>(
            queryKey,
            previousMembers.map((member) =>
              member.id === input.memberId
                ? {
                    ...member,
                    role: input.role,
                    custom_role_id: input.role === "manager" ? (input.customRoleId ?? null) : null,
                  }
                : member,
            ),
          );
        }
        return { previousMembers };
      },
      onError: (_error, _input, context) => {
        if (context?.previousMembers) {
          queryClient.setQueryData(["members", workspaceId], context.previousMembers);
        }
      },
      onSuccess: invalidate,
    }),
  };
}

/** Member add/remove mutations, both enforced server-side. */
export function useMemberMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const add = useServerFn(addMember);
  const remove = useServerFn(removeMember);
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
  };

  return {
    add: useMutation({
      mutationFn: (input: {
        email: string;
        role: "admin" | "manager" | "member" | "viewer";
        customRoleId?: string | null;
      }) => add({ data: { workspaceId: workspaceId!, ...input } }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (memberId: string) => remove({ data: { memberId } }),
      onMutate: async (memberId) => {
        const queryKey = ["members", workspaceId] as const;
        await queryClient.cancelQueries({ queryKey });
        const previousMembers = queryClient.getQueryData<WorkspaceMemberWithProfile[]>(queryKey);
        if (previousMembers) {
          queryClient.setQueryData<WorkspaceMemberWithProfile[]>(
            queryKey,
            previousMembers.filter((member) => member.id !== memberId),
          );
        }
        return { previousMembers };
      },
      onError: (_error, _memberId, context) => {
        if (context?.previousMembers) {
          queryClient.setQueryData(["members", workspaceId], context.previousMembers);
        }
      },
      onSuccess: invalidate,
    }),
  };
}

/** Creates a new workplace; requires the `workplace.create` permission. */
export function useCreateWorkplace(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const create = useServerFn(createWorkplace);
  return useMutation({
    mutationFn: (name: string) =>
      create({ data: { fromWorkspaceId: workspaceId!, name } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
