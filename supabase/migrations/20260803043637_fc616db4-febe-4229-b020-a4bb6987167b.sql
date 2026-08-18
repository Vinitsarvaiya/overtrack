ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hourly_rate numeric NOT NULL DEFAULT 0;