import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { type Workspace } from "@/features/workspaces/types";

import { type Entry } from "@/features/entries/types";

import { type EntryStatus } from "@/features/entries/types";

import { type EntryInput } from "@/features/entries/types";

import { type WorkflowAction } from "@/features/entries/types";

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
            ? previousEntries.map((entry) =>
                entry.id === input.id ? { ...entry, ...optimisticEntry } : entry,
              )
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
      const { error } = await supabase.from("overtime_entries").update(patch).eq("id", entry.id);
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
