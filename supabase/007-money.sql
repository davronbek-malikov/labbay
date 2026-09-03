-- Money in and money out.
-- Run once in the Supabase SQL editor, after 006. Safe to re-run.
--
-- Student fees already live in `payments`. This table is for everything else:
-- rent, transport, books, and any income that is not a course fee.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12, 2) not null default 0,
  currency text not null default 'UZS' check (currency in ('UZS', 'USD', 'KRW')),
  category text not null default '',
  note text not null default '',
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists transactions_teacher_idx
  on public.transactions (teacher_id, occurred_at desc);

alter table public.transactions enable row level security;

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null;
end $$;
