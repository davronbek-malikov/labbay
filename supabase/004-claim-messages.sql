-- Stops a message being sent twice.
-- Run this once in the Supabase SQL editor, after 003. Safe to re-run.
--
-- The worker claims a message by moving it queued -> sending in one atomic
-- update. If a second worker (or a restarted one) tries the same row, the
-- update matches nothing and it moves on. Without this, two processes could
-- both read the same queued row and both message the student.
alter table public.messages
  drop constraint if exists messages_status_check;

alter table public.messages
  add constraint messages_status_check
  check (status in ('queued', 'sending', 'sent', 'failed'));
