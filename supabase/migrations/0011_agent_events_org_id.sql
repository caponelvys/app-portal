-- Add org_id to agent_events so msp_tech org-scoping is an indexed filter
-- instead of loading every scoped device_id and passing them as an in(...) list
-- (which the monitor page capped at 5000, silently dropping events for larger
-- fleets).
--
-- The agent writes agent_events directly via PostgREST with the anon key and
-- only sends device_id/level/event/message. Rather than ship an agent release,
-- a BEFORE INSERT trigger derives org_id from the device row, so every writer
-- (current + future agents) gets it for free. Rows for devices that don't exist
-- yet (e.g. enroll_failed before enrollment) keep org_id NULL — correct, since
-- there is no org to scope them to; only the unscoped (msp_admin) view sees them.

alter table public.agent_events
  add column if not exists org_id uuid;

-- Backfill existing rows from their device's org.
update public.agent_events e
set    org_id = d.org_id
from   public.devices d
where  e.device_id = d.device_id
  and  e.org_id is null;

-- Supports the scoped event stream: filter by org_id, newest first.
create index if not exists idx_agent_events_org_created
  on public.agent_events (org_id, created_at desc);

-- Auto-populate org_id on insert from the device row. SECURITY DEFINER so the
-- anon-key agent insert can read devices regardless of anon's grants.
create or replace function public.set_agent_event_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select d.org_id into new.org_id
    from   public.devices d
    where  d.device_id = new.device_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agent_events_org_id on public.agent_events;
create trigger trg_agent_events_org_id
  before insert on public.agent_events
  for each row execute function public.set_agent_event_org_id();
