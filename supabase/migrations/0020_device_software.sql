-- M1 Discovery: per-device installed-software inventory.
--
-- The agent already enumerates running processes each cycle to enforce blocks,
-- but discards them. This adds a periodic INSTALLED-software scan (name, version,
-- publisher, path) reported hourly + on-change, persisted here. It's the input
-- that later milestones need: learning-mode baselines, publisher/hash rules, and
-- third-party patch detection (outdated-version → push update).
--
-- Access model mirrors the other agent-written tables (device_commands / agent_
-- events): RLS ON with explicit anon policies (new tables here auto-enable RLS,
-- and without a policy the anon-key agent silently sees/writes nothing — the bug
-- fixed in 0014). The portal reads via the service-role client (bypasses RLS).
--
-- sha256 is intentionally left nullable/empty in M1 — binary hashing is deferred
-- to M2, where hash-based rules actually consume it.

create table if not exists public.device_software (
  id           uuid primary key default gen_random_uuid(),
  device_id    text not null,                       -- matches devices.device_id
  name         text not null,
  version      text not null default '',            -- '' when unknown; part of the upsert key
  publisher    text,                                -- signer / vendor, best-effort per OS
  source       text,                                -- apps_dir | registry | dpkg | rpm | flatpak | snap
  install_path text,
  sha256       text,                                -- deferred to M2 (nullable for now)
  org_id       uuid,                                -- derived from the device (see trigger)
  first_seen   timestamptz not null default now(),  -- set once on insert; never overwritten
  last_seen    timestamptz not null default now(),  -- refreshed every scan; drives stale-pruning
  unique (device_id, name, version)                 -- PostgREST upsert target
);

-- Per-device view (device detail "Software" tab).
create index if not exists idx_device_software_device
  on public.device_software (device_id);
-- Scoped fleet search + install counts (msp_tech).
create index if not exists idx_device_software_org_name
  on public.device_software (org_id, name);
-- Global fleet search + install counts (msp_admin, org_id unfiltered).
create index if not exists idx_device_software_name
  on public.device_software (name);

-- Auto-populate org_id from the device row on insert. SECURITY DEFINER so the
-- anon-key agent insert can read devices regardless of anon's grants. Mirrors
-- set_agent_event_org_id() from 0011. Rows for not-yet-enrolled devices keep
-- org_id NULL (only the unscoped msp_admin view sees them).
create or replace function public.set_device_software_org_id()
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

drop trigger if exists trg_device_software_org_id on public.device_software;
create trigger trg_device_software_org_id
  before insert on public.device_software
  for each row execute function public.set_device_software_org_id();

-- Freshness marker so the portal can flag devices whose inventory is stale
-- (agent offline / pre-1.7.17). Written by the agent alongside each scan.
alter table public.devices
  add column if not exists last_inventory_at timestamptz;

-- Access: service-role (portal) full; anon (agent) upsert + stale-prune.
grant all on public.device_software to service_role;
grant select, insert, update, delete on public.device_software to anon;

alter table public.device_software enable row level security;

drop policy if exists "anon reads device_software"   on public.device_software;
drop policy if exists "anon inserts device_software" on public.device_software;
drop policy if exists "anon updates device_software" on public.device_software;
drop policy if exists "anon deletes device_software" on public.device_software;

create policy "anon reads device_software"
  on public.device_software for select
  using (auth.role() = 'anon');

create policy "anon inserts device_software"
  on public.device_software for insert
  with check (auth.role() = 'anon');

create policy "anon updates device_software"
  on public.device_software for update
  using (auth.role() = 'anon');

create policy "anon deletes device_software"
  on public.device_software for delete
  using (auth.role() = 'anon');
