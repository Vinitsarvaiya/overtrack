import type { Tables } from "@/integrations/supabase/types";

export type CalendarDayRow = Tables<"workspace_calendar_days">;

export type CalendarDayInput = {
  workspace_id: string;
  day_date: string;
  day_type: string;
  hours: number | null;
  label: string | null;
};
