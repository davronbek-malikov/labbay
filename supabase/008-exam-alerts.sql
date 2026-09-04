-- Exam reminders you cannot lose.
-- Run once in the Supabase SQL editor, after 007. Safe to re-run.
--
-- Holds the exam date the teacher has actually acknowledged. The alert shows
-- whenever this does not match the course's current final exam date, so
-- closing the alert brings it back, and moving the exam raises it again.
alter table public.groups
  add column if not exists exam_ack_date date;
