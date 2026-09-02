-- Labbay schema.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: every statement is guarded.

-- ---------------------------------------------------------------- profiles
-- One row per teacher. Holds the name the app greets you with.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- students
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  name text not null,
  telegram text not null default '',
  subject text not null default '',
  group_name text not null default '',
  level text not null default '',
  ai_notes text not null default '',
  status text not null default 'active' check (status in ('active', 'paused')),
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists students_teacher_idx on public.students (teacher_id);

-- ------------------------------------------------------------------ nudges
create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  name text not null,
  audience jsonb not null default '{"kind":"all"}'::jsonb,
  days int[] not null default '{}',
  hour int not null default 19 check (hour between 0 and 23),
  minute int not null default 0 check (minute between 0 and 59),
  intent text not null default '',
  tone text not null default 'warm',
  channel text not null default 'text',
  personalize boolean not null default true,
  status text not null default 'active' check (status in ('active', 'paused')),
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nudges_teacher_idx on public.nudges (teacher_id);

-- ---------------------------------------------------------------- messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  student_id uuid references public.students on delete cascade,
  nudge_id uuid references public.nudges on delete set null,
  text text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  channel text not null default 'text',
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists messages_teacher_idx on public.messages (teacher_id);
create index if not exists messages_scheduled_idx on public.messages (teacher_id, scheduled_at desc);

-- ---------------------------------------------------------------- settings
create table if not exists public.settings (
  teacher_id uuid primary key references auth.users on delete cascade,
  telegram_phone text not null default '',
  telegram_connected boolean not null default false,
  delay_min_seconds int not null default 45,
  delay_max_seconds int not null default 180,
  daily_cap int not null default 40,
  quiet_hours_start int not null default 22,
  quiet_hours_end int not null default 8,
  default_tone text not null default 'warm',
  language text not null default 'en',
  autopilot boolean not null default true,
  last_auto_run_at timestamptz
);

-- ------------------------------------------------------- row level security
-- Each teacher can only ever touch their own rows. Enforced by the database,
-- so a bug in the app cannot leak one teacher's students to another.
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.nudges   enable row level security;
alter table public.messages enable row level security;
alter table public.settings enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own students" on public.students;
create policy "own students" on public.students
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

drop policy if exists "own nudges" on public.nudges;
create policy "own nudges" on public.nudges
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

-- ------------------------------------------------------- new account setup
-- Gives every new teacher a profile (with the name they signed up with) and a
-- settings row, so the app never has to cope with them missing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;

  insert into public.settings (teacher_id)
  values (new.id)
  on conflict (teacher_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------- realtime
-- Lets a change made on your phone appear on your laptop without a refresh.
do $$
begin
  alter publication supabase_realtime add table public.students;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.nudges;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.settings;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------- delete my account
-- Cascades to every table, because they all reference auth.users on delete
-- cascade. The auth.uid() filter stops it touching anyone else's account.
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

-- Kept here too so a brand new project gets it without the migrations.
alter table public.groups
  add column if not exists currency text not null default 'UZS';
