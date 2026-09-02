-- Lets the app show whether the worker is actually running.
-- Run this once in the Supabase SQL editor, after 004. Safe to re-run.
--
-- The worker stamps this every cycle. If it goes stale, the app can say so
-- instead of leaving you guessing why nothing is sending.
alter table public.settings
  add column if not exists worker_seen_at timestamptz;
