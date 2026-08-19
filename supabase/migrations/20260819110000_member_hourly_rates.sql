ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS overtime_hourly_rate numeric(10,2);
