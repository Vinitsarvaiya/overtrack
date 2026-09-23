import type { Tables } from "@/integrations/supabase/types";

export type Entry = Tables<"overtime_entries">;

export type HistoryRecord = Tables<"entry_history">;

export type EntryStatus = Entry["status"];

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

export type WorkflowAction = "submit" | "approve" | "reject" | "reopen";
