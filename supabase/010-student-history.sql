-- Remembering which courses a student has been through.
-- Run once in the Supabase SQL editor, after 009. Safe to re-run.
--
-- A student row only ever pointed at one course, so moving someone from
-- "Beginners" to "IELTS evening" silently erased the fact they ever did the
-- first one. These two columns keep that history.
alter table public.students
  add column if not exists enrolled_at date;

-- [{ "groupId": "...", "name": "Beginners A2", "from": "2026-01-10", "to": "2026-06-01" }]
-- The name is copied in so history survives the course itself being deleted.
alter table public.students
  add column if not exists past_courses jsonb not null default '[]'::jsonb;

-- Anyone already on a course started at some point; the created date is the
-- honest best guess we have.
update public.students
   set enrolled_at = created_at::date
 where group_id is not null and enrolled_at is null;
