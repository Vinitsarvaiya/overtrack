import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { type CalendarDayRow } from "@/features/calendar/types";
import { type CalendarDayInput } from "@/features/calendar/types";

/** Working-calendar overrides (holidays, half days, custom hours) for a workspace. */
export function useCalendarDays(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["calendar-days", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_calendar_days")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("day_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Upsert on (workspace, date) so re-adding a date edits it instead of failing. */
export function useSaveCalendarDay(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CalendarDayInput) => {
      const { error } = await supabase
        .from("workspace_calendar_days")
        .upsert(input, { onConflict: "workspace_id,day_date" });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const queryKey = ["calendar-days", workspaceId] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousDays = queryClient.getQueryData<CalendarDayRow[]>(queryKey);
      if (previousDays) {
        const optimisticDay: CalendarDayRow = {
          id:
            previousDays.find(
              (day) => day.workspace_id === input.workspace_id && day.day_date === input.day_date,
            )?.id ?? `optimistic-${crypto.randomUUID()}`,
          workspace_id: input.workspace_id,
          day_date: input.day_date,
          day_type: input.day_type,
          hours: input.hours,
          label: input.label,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const existing = previousDays.some(
          (day) => day.workspace_id === input.workspace_id && day.day_date === input.day_date,
        );
        queryClient.setQueryData<CalendarDayRow[]>(
          queryKey,
          existing
            ? previousDays.map((day) =>
                day.workspace_id === input.workspace_id && day.day_date === input.day_date
                  ? { ...day, ...optimisticDay }
                  : day,
              )
            : [...previousDays, optimisticDay].sort((a, b) => a.day_date.localeCompare(b.day_date)),
        );
      }
      return { previousDays };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDays) {
        queryClient.setQueryData(["calendar-days", workspaceId], context.previousDays);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-days", workspaceId] }),
  });
}

export function useDeleteCalendarDay(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_calendar_days").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const queryKey = ["calendar-days", workspaceId] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousDays = queryClient.getQueryData<CalendarDayRow[]>(queryKey);
      if (previousDays) {
        queryClient.setQueryData<CalendarDayRow[]>(
          queryKey,
          previousDays.filter((day) => day.id !== id),
        );
      }
      return { previousDays };
    },
    onError: (_error, _id, context) => {
      if (context?.previousDays) {
        queryClient.setQueryData(["calendar-days", workspaceId], context.previousDays);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-days", workspaceId] }),
  });
}
