-- Courses, payments, and course currency.
--
-- Run this ONCE in the Supabase SQL editor, after schema.sql.
-- This is the only migration you need for the Students feature — it replaces
-- the old 003 file. Safe to re-run.

-- ------------------------------------------------------------------ groups
-- A course. `kind` is what separates a class from a one-to-one student;
-- both carry the same dates and the same fee.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  name text not null,
  kind text not null default 'group' check (kind in ('group', 'individual')),
  start_date date,
  end_date date,
  final_exam_date date,
  fee numeric(12, 2) not null default 0,
  currency text not null default 'UZS' check (currency in ('UZS', 'USD', 'KRW')),
  created_at timestamptz not null default now()
);

-- For a project where groups already existed without it.
alter table public.groups
  add column if not exists currency text not null default 'UZS';
create index if not exists groups_teacher_idx on public.groups (teacher_id);

-- Students point at a course instead of holding a group name.
alter table public.students
  add column if not exists group_id uuid references public.groups on delete set null;

-- Move any existing group names across, then retire the old column.
-- Everything touching group_name is dynamic, so this parses cleanly on a
-- project where that column has already been dropped.
do $$
declare
  rec record;
  gid uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'group_name'
  ) then
    for rec in
      execute 'select distinct teacher_id, group_name as gname
               from public.students
               where coalesce(group_name, '''') <> '''''
    loop
      select id into gid
        from public.groups
       where teacher_id = rec.teacher_id and name = rec.gname;

      if gid is null then
        insert into public.groups (teacher_id, name, kind)
        values (rec.teacher_id, rec.gname, 'group')
        returning id into gid;
      end if;

      execute 'update public.students
                  set group_id = $1
                where teacher_id = $2
                  and group_name = $3
                  and group_id is null'
        using gid, rec.teacher_id, rec.gname;
    end loop;

    execute 'alter table public.students drop column group_name';
  end if;
end $$;

-- ---------------------------------------------------------------- payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  amount numeric(12, 2) not null default 0,
  paid_at date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists payments_teacher_idx on public.payments (teacher_id);
create index if not exists payments_student_idx on public.payments (student_id);

-- ------------------------------------------------------- row level security
alter table public.groups   enable row level security;
alter table public.payments enable row level security;

drop policy if exists "own groups" on public.groups;
create policy "own groups" on public.groups
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

-- ----------------------------------------------------------------- realtime
do $$
begin
  alter publication supabase_realtime add table public.groups;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null;
end $$;
