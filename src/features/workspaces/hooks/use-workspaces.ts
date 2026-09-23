import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { type Workspace } from "@/features/workspaces/types";

/** Workspaces the signed-in user belongs to, with their role in each. */
export function useMyWorkspaces(userId: string | undefined) {
  return useQuery({
    queryKey: ["workspaces", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("role, workspace:workspaces(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((row) => row.workspace)
        .map((row) => ({ role: row.role, workspace: row.workspace as Workspace }));
    },
  });
}

export function useUpdateWorkspace(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Workspace>) => {
      const { error } = await supabase.from("workspaces").update(values).eq("id", workspaceId!);
      if (error) throw error;
    },
    onMutate: async (values) => {
      const queryKey = ["workspaces"] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces =
        queryClient.getQueryData<{ role: string; workspace: Workspace }[]>(queryKey);
      if (previousWorkspaces && workspaceId) {
        queryClient.setQueryData(
          queryKey,
          previousWorkspaces.map((item) =>
            item.workspace.id === workspaceId
              ? { ...item, workspace: { ...item.workspace, ...values } }
              : item,
          ),
        );
      }
      return { previousWorkspaces };
    },
    onError: (_error, _values, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(["workspaces"], context.previousWorkspaces);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}
