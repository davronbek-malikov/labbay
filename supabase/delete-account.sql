-- Lets a teacher delete their own account from inside the app.
-- Run this once in the Supabase SQL editor (it is also included in schema.sql
-- for fresh projects).
--
-- Deleting the auth user cascades to profiles, students, nudges, messages and
-- settings, because every table references auth.users on delete cascade.
-- `security definer` is what gives it the privilege to touch auth.users, and
-- the `auth.uid()` filter is what stops it touching anybody else's.

create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
