import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { addMember, removeMember } from "@/features/members/api/members.functions";

import { type WorkspaceMemberWithProfile } from "@/features/roles/types";

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
