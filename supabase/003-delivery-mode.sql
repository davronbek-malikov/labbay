-- How messages get delivered.
-- Run this once in the Supabase SQL editor, after 002. Safe to re-run.
--
--   simulate : the web app marks queued messages as sent. Nothing reaches
--              Telegram. Useful for trying the app out.
--   worker   : only the always-on worker sends and marks messages. The app
--              never touches their status.
alter table public.settings
  add column if not exists delivery_mode text not null default 'simulate';

do $$
begin
  alter table public.settings
    add constraint settings_delivery_mode_check
    check (delivery_mode in ('simulate', 'worker'));
exception when duplicate_object then null;
end $$;
