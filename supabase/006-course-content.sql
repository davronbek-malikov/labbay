-- What a course actually teaches.
-- Run once in the Supabase SQL editor, after 005. Safe to re-run.
--
-- Free-form lists, because every teacher organises a course differently.
alter table public.groups
  add column if not exists topics text[] not null default '{}',
  add column if not exists homework text[] not null default '{}',
  add column if not exists notes text not null default '';
