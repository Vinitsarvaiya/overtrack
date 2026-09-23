import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

import { updateMemberRates } from "@/features/members/api/members.functions";

import { type Member } from "@/features/members/types";

import { type Profile } from "@/features/members/types";

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      const members = data ?? [];
      if (members.length === 0) return [] as (Member & { profile: Profile | null })[];
      // profiles has no FK to workspace_members, so join it manually.
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .in(
          "id",
          members.map((member) => member.user_id),
        );
      if (profileError) throw profileError;
      return members.map((member) => ({
        ...member,
        profile: (profiles ?? []).find((profile) => profile.id === member.user_id) ?? null,
      }));
    },
  });
}

export function useMemberRateHistory(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member-rate-history", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_rate_history")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateMemberRates(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const updateRates = useServerFn(updateMemberRates);
  return useMutation({
    mutationFn: async (input: {
      memberId: string;
      hourlyRate: number | null;
      overtimeHourlyRate: number | null;
    }) => updateRates({ data: input }),
    onMutate: async (input) => {
      const queryKey = ["members", workspaceId] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousMembers =
        queryClient.getQueryData<(Member & { profile: Profile | null })[]>(queryKey);
      if (previousMembers) {
        queryClient.setQueryData(
          queryKey,
          previousMembers.map((member) =>
            member.id === input.memberId
              ? {
                  ...member,
                  hourly_rate: input.hourlyRate,
                  overtime_hourly_rate: input.overtimeHourlyRate,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", workspaceId] }),
  });
}
