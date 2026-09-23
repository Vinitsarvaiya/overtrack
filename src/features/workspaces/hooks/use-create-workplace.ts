import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { createWorkplace } from "@/features/members/api/members.functions";

/** Creates a new workplace; requires the `workplace.create` permission. */
export function useCreateWorkplace(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const create = useServerFn(createWorkplace);
  return useMutation({
    mutationFn: (name: string) => create({ data: { fromWorkspaceId: workspaceId!, name } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
