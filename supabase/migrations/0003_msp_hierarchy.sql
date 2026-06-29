-- MSP hierarchy: Org > Location > Device
-- Run in the Supabase SQL editor after the earlier migrations.
--
-- Establishes multi-tenant structure. Existing devices are backfilled into a
-- "Default Org" / "Default Location" so nothing breaks. org_id is denormalized
-- onto devices (derivable via location) for fast filtering at scale.

create table if not exists public.orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists locations_org_idx on public.locations(org_id);

alter table public.devices add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.devices add column if not exists org_id      uuid references public.orgs(id)      on delete set null;
create index if not exists devices_org_idx      on public.devices(org_id);
create index if not exists devices_location_idx on public.devices(location_id);

-- Backfill any existing/unassigned devices into a default org + location.
do $$
declare
  d_org uuid;
  d_loc uuid;
begin
  if exists (select 1 from public.devices where org_id is null) then
    select id into d_org from public.orgs where name = 'Default Org' limit 1;
    if d_org is null then
      insert into public.orgs (name) values ('Default Org') returning id into d_org;
    end if;

    select id into d_loc from public.locations where org_id = d_org and name = 'Default Location' limit 1;
    if d_loc is null then
      insert into public.locations (org_id, name) values (d_org, 'Default Location') returning id into d_loc;
    end if;

    update public.devices set org_id = d_org, location_id = d_loc where org_id is null;
  end if;
end $$;

-- Match the existing tables' posture (privileged writes are gated in API routes).
alter table public.orgs      disable row level security;
alter table public.locations disable row level security;
