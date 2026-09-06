-- Payments get their own currency.
-- Run once in the Supabase SQL editor, after 010. Safe to re-run.
--
-- A payment used to borrow the currency of the student's course, so a student
-- with no course was always shown in so'm, and a won payment against a so'm
-- course could not be recorded at all.
alter table public.payments
  add column if not exists currency text not null default 'UZS';

do $$
begin
  alter table public.payments
    add constraint payments_currency_check
    check (currency in ('UZS', 'USD', 'KRW'));
exception when duplicate_object then null;
end $$;

-- Existing payments keep the meaning they had: their course's currency.
update public.payments p
   set currency = coalesce(g.currency, 'UZS')
  from public.students s
  left join public.groups g on g.id = s.group_id
 where p.student_id = s.id
   and p.currency = 'UZS'
   and coalesce(g.currency, 'UZS') <> 'UZS';
