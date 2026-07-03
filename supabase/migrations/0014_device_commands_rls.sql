-- Fix: the agent could never see its command queue.
--
-- 0013 granted anon select/update on device_commands, but new tables in this
-- project get RLS auto-enabled, and there was no anon policy — so the agent
-- (anon key) polled an empty queue (RLS filtered every row) and never ran any
-- uninstall. Add explicit anon read/update policies, mirroring the devices
-- table. The portal uses the service-role client (bypasses RLS), so no
-- authenticated/staff policy is needed here.

alter table public.device_commands enable row level security;

drop policy if exists "anon reads device_commands"   on public.device_commands;
drop policy if exists "anon updates device_commands" on public.device_commands;

create policy "anon reads device_commands"
  on public.device_commands for select
  using (auth.role() = 'anon');

create policy "anon updates device_commands"
  on public.device_commands for update
  using (auth.role() = 'anon');
