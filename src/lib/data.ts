import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { updateMemberRates } from "@/lib/members.functions";

export type Workspace = Tables<"workspaces">;
export type Member = Tables<"workspace_members">;
export type Entry = Tables<"overtime_entries">;
export type Profile = Tables<"profiles">;
export type HistoryRecord = Tables<"entry_history">;
export type MemberRateHistoryRecord = Tables<"member_rate_history">;
export type EntryStatus = Entry["status"];

export const ATTACHMENT_BUCKET = "entry-attachments";

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

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** All entries in a workspace (RLS scopes this to workspaces you belong to). */
export function useEntries(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["entries", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("overtime_entries")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("entry_date", { ascending: false })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

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

/** Audit trail for a single entry. RLS limits this to owners and admins. */
export function useEntryHistory(entryId: string | undefined) {
  return useQuery({
    queryKey: ["entry-history", entryId],
    enabled: Boolean(entryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entry_history")
        .select("*")
        .eq("entry_id", entryId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type EntryInput = {
  id?: string;
  workspace_id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  break_start: string | null;
  break_end: string | null;
  category: string;
  tags: string[];
  notes: string | null;
  overtime_override: number | null;
  attachment_path: string | null;
  attachment_name: string | null;
  status?: EntryStatus;
};

export function useSaveEntry(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EntryInput) => {
      const { id, ...values } = input;
      const query = id
        ? supabase.from("overtime_entries").update(values).eq("id", id)
        : supabase.from("overtime_entries").insert(values);
      const { error } = await query;
      if (error) throw error;
    },
    onMutate: async (input) => {
      const queryKey = ["entries", workspaceId] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousEntries = queryClient.getQueryData<Entry[]>(queryKey);
      if (previousEntries) {
        const optimisticEntry: Entry = {
          id: input.id ?? `optimistic-${crypto.randomUUID()}`,
          workspace_id: input.workspace_id,
          user_id: input.user_id,
          entry_date: input.entry_date,
          start_time: input.start_time,
          end_time: input.end_time,
          break_minutes: input.break_minutes,
          break_start: input.break_start,
          break_end: input.break_end,
          category: input.category,
          tags: input.tags,
          notes: input.notes,
          overtime_override: input.overtime_override,
          attachment_path: input.attachment_path,
          attachment_name: input.attachment_name,
          status: input.status ?? "draft",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          submitted_at: null,
          approved_at: null,
          approved_by: null,
          rejection_reason: null,
          locked: false,
        };

        queryClient.setQueryData<Entry[]>(
          queryKey,
          input.id
            ? previousEntries.map((entry) => (entry.id === input.id ? { ...entry, ...optimisticEntry } : entry))
            : [optimisticEntry, ...previousEntries],
        );
      }
      return { previousEntries };
    },
    onError: (_error, _input, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(["entries", workspaceId], context.previousEntries);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries", workspaceId] }),
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

export function useDeleteEntry(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("overtime_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const queryKey = ["entries", workspaceId] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousEntries = queryClient.getQueryData<Entry[]>(queryKey);
      if (previousEntries) {
        queryClient.setQueryData<Entry[]>(
          queryKey,
          previousEntries.filter((entry) => entry.id !== id),
        );
      }
      return { previousEntries };
    },
    onError: (_error, _id, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(["entries", workspaceId], context.previousEntries);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries", workspaceId] }),
  });
}

export type WorkflowAction = "submit" | "approve" | "reject" | "reopen";

/**
 * Drives the draft → submitted → approved / rejected / reopened workflow.
 * Locking is applied on approval when the workspace requires it.
 */
export function useEntryWorkflow(workspace: Workspace | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entry,
      action,
      reason,
      actorId,
    }: {
      entry: Entry;
      action: WorkflowAction;
      reason?: string;
      actorId: string;
    }) => {
      const patch: Partial<Entry> = {};
      if (action === "submit") {
        patch.status = "submitted";
        patch.submitted_at = new Date().toISOString();
        patch.rejection_reason = null;
      } else if (action === "approve") {
        patch.status = "approved";
        patch.approved_at = new Date().toISOString();
        patch.approved_by = actorId;
        patch.locked = Boolean(workspace?.lock_after_approval);
      } else if (action === "reject") {
        patch.status = "rejected";
        patch.rejection_reason = reason ?? null;
        patch.locked = false;
      } else {
        patch.status = "reopened";
        patch.locked = false;
        patch.approved_at = null;
        patch.approved_by = null;
      }
      const { error } = await supabase
        .from("overtime_entries")
        .update(patch)
        .eq("id", entry.id);
      if (error) throw error;
    },
    onMutate: async (variables) => {
      const queryKey = ["entries", workspace?.id] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousEntries = queryClient.getQueryData<Entry[]>(queryKey);
      if (previousEntries) {
        let patch: Partial<Entry> = {};
        if (variables.action === "submit") {
          patch = {
            status: "submitted",
            submitted_at: new Date().toISOString(),
            rejection_reason: null,
          };
        } else if (variables.action === "approve") {
          patch = {
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: variables.actorId,
            locked: Boolean(workspace?.lock_after_approval),
          };
        } else if (variables.action === "reject") {
          patch = {
            status: "rejected",
            rejection_reason: variables.reason ?? null,
            locked: false,
          };
        } else {
          patch = {
            status: "reopened",
            locked: false,
            approved_at: null,
            approved_by: null,
          };
        }

        queryClient.setQueryData<Entry[]>(
          queryKey,
          previousEntries.map((entry) =>
            entry.id === variables.entry.id ? { ...entry, ...patch } : entry,
          ),
        );
      }
      return { previousEntries };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(["entries", workspace?.id], context.previousEntries);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["entries", workspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["entry-history", variables.entry.id] });
    },
  });
}

/** Legacy helper kept for simple status flips. */
export function useSetEntryStatus(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EntryStatus }) => {
      const { error } = await supabase.from("overtime_entries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries", workspaceId] }),
  });
}

export function useUpdateWorkspace(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Workspace>) => {
      const { error } = await supabase
        .from("workspaces")
        .update(values)
        .eq("id", workspaceId!);
      if (error) throw error;
    },
    onMutate: async (values) => {
      const queryKey = ["workspaces"] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousWorkspaces = queryClient.getQueryData<{ role: string; workspace: Workspace }[]>(queryKey);
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
      const previousMembers = queryClient.getQueryData<(Member & { profile: Profile | null })[]>(queryKey);
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

export type CalendarDayRow = Tables<"workspace_calendar_days">;

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

export type CalendarDayInput = {
  workspace_id: string;
  day_date: string;
  day_type: string;
  hours: number | null;
  label: string | null;
};

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
          id: previousDays.find((day) => day.workspace_id === input.workspace_id && day.day_date === input.day_date)?.id
            ?? `optimistic-${crypto.randomUUID()}`,
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


/** Uploads to `{workspace}/{user}/{uuid}-{filename}` so storage policies can scope access. */
export async function uploadAttachment(
  file: File,
  workspaceId: string,
  userId: string,
): Promise<{ path: string; name: string }> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${workspaceId}/${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file);
  if (error) throw error;
  return { path, name: file.name };
}

/** Short-lived signed URL for a private attachment. */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
