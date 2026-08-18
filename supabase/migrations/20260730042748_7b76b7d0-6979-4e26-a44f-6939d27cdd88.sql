-- Workspace settings
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS time_format text NOT NULL DEFAULT '24h',
  ADD COLUMN IF NOT EXISTS enable_breaks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_notes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_tags boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_attachments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_multiple_entries boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_overtime boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_overtime_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lock_after_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_reopen boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_reject boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_future_dates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes_max_length integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY['Development','Testing','Meeting','Support','Research','Deployment','Training','Documentation'];

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_time_format_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_time_format_check CHECK (time_format IN ('12h','24h'));

-- Entry fields
ALTER TABLE public.overtime_entries
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS break_start time,
  ADD COLUMN IF NOT EXISTS break_end time,
  ADD COLUMN IF NOT EXISTS overtime_override numeric(6,2),
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

UPDATE public.overtime_entries SET status = 'submitted' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS overtime_entries_ws_date_idx
  ON public.overtime_entries (workspace_id, entry_date);

-- Overlap prevention (handles overnight shifts)
CREATE OR REPLACE FUNCTION public.entry_minutes_range(_start time, _end time)
RETURNS int4range
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT int4range(
    (extract(hour from _start)*60 + extract(minute from _start))::int,
    CASE WHEN _end > _start
      THEN (extract(hour from _end)*60 + extract(minute from _end))::int
      ELSE (extract(hour from _end)*60 + extract(minute from _end))::int + 1440
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_entry_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  conflict_count int;
BEGIN
  SELECT count(*) INTO conflict_count
  FROM public.overtime_entries e
  WHERE e.workspace_id = NEW.workspace_id
    AND e.user_id = NEW.user_id
    AND e.entry_date = NEW.entry_date
    AND e.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND public.entry_minutes_range(e.start_time, e.end_time)
        && public.entry_minutes_range(NEW.start_time, NEW.end_time);

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'This time range overlaps an existing entry on %', NEW.entry_date
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS overtime_entries_no_overlap ON public.overtime_entries;
CREATE TRIGGER overtime_entries_no_overlap
  BEFORE INSERT OR UPDATE OF entry_date, start_time, end_time ON public.overtime_entries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_entry_overlap();

-- Lock enforcement: locked entries only changeable by owner/admin
CREATE OR REPLACE FUNCTION public.enforce_entry_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r app_role;
BEGIN
  IF COALESCE(OLD.locked, false) THEN
    SELECT public.workspace_role(OLD.workspace_id, auth.uid()) INTO r;
    IF r IS NULL OR r NOT IN ('owner','admin') THEN
      RAISE EXCEPTION 'This entry is locked after approval' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS overtime_entries_lock_guard ON public.overtime_entries;
CREATE TRIGGER overtime_entries_lock_guard
  BEFORE UPDATE OR DELETE ON public.overtime_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_entry_lock();

-- Audit history
CREATE TABLE IF NOT EXISTS public.entry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entry_history TO authenticated;
GRANT ALL ON public.entry_history TO service_role;
ALTER TABLE public.entry_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins read entry history" ON public.entry_history;
CREATE POLICY "Owners and admins read entry history"
  ON public.entry_history FOR SELECT TO authenticated
  USING (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'));

CREATE INDEX IF NOT EXISTS entry_history_entry_idx ON public.entry_history (entry_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_entry_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'created', NEW.status::text);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, old_value)
    VALUES (OLD.id, OLD.workspace_id, actor, 'deleted', OLD.entry_date::text);
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'status_changed', 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'edited', 'start_time', OLD.start_time::text, NEW.start_time::text);
  END IF;
  IF NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'edited', 'end_time', OLD.end_time::text, NEW.end_time::text);
  END IF;
  IF NEW.break_minutes IS DISTINCT FROM OLD.break_minutes THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'edited', 'break_minutes', OLD.break_minutes::text, NEW.break_minutes::text);
  END IF;
  IF NEW.entry_date IS DISTINCT FROM OLD.entry_date THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'edited', 'entry_date', OLD.entry_date::text, NEW.entry_date::text);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'edited', 'notes', OLD.notes, NEW.notes);
  END IF;
  IF NEW.tags IS DISTINCT FROM OLD.tags THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'edited', 'tags', array_to_string(OLD.tags, ', '), array_to_string(NEW.tags, ', '));
  END IF;
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason AND NEW.rejection_reason IS NOT NULL THEN
    INSERT INTO public.entry_history (entry_id, workspace_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, NEW.workspace_id, actor, 'rejected', 'reason', NULL, NEW.rejection_reason);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_entry_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_entry_overlap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_entry_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS overtime_entries_history ON public.overtime_entries;
CREATE TRIGGER overtime_entries_history
  AFTER INSERT OR UPDATE OR DELETE ON public.overtime_entries
  FOR EACH ROW EXECUTE FUNCTION public.log_entry_history();