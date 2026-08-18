-- 1. Statuses
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'reopened';