import type { Tables } from "@/integrations/supabase/types";

export type Member = Tables<"workspace_members">;

export type Profile = Tables<"profiles">;

export type MemberRateHistoryRecord = Tables<"member_rate_history">;
