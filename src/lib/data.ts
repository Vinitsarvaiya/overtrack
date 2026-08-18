import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Workspace = Tables<"workspaces">;
export type Member = Tables<"workspace_members">;
export type Entry = Tables<"overtime_entries">;
export type Profile = Tables<"profiles">;
export type HistoryRecord = Tables<"entry_history">;
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries", workspaceId] }),
  });
}

export function useDeleteEntry(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("overtime_entries").delete().eq("id", id);
      if (error) throw error;
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
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
