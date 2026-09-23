export type Draft = {
  name: string;
  currency: string;
  timezone: string;
  standard_daily_hours: number;
  default_break_minutes: number;
  time_format: string;
  notes_max_length: number;
  tags: string[];
  enable_standard_hours: boolean;
  enable_breaks: boolean;
  enable_member_rates: boolean;
  allow_manager_rate_permissions: boolean;
  enable_notes: boolean;
  enable_attachments: boolean;
  enable_tags: boolean;
  allow_multiple_entries: boolean;
  allow_future_dates: boolean;
  enable_overtime: boolean;
  allow_overtime_override: boolean;
  require_approval: boolean;
  lock_after_approval: boolean;
  allow_reopen: boolean;
  allow_reject: boolean;
};

export type ProfileDraft = { full_name: string; company: string };
