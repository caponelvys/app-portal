-- M3 CP1: rollout rings — ordered per-org device groups (test → pilot → prod)
-- for staged policy rollout, so a change is validated on a small ring before it
-- reaches the whole fleet. A device belongs to at most one ring within its org.
--
-- This is the grouping + assignment foundation. Enforcement wiring (ring as a
-- policy scope, precedence device > ring > location > org) lands in CP2, where
-- the agent reads devices.ring_id and factors ring policies into resolution.

create table if not exists public.rings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  name       text not null,
  position   int  not null default 0,   -- rollout order: lower ships first (test=0…)
  created_at timestamptz not null default now()
);
create index if not exists idx_rings_org on public.rings (org_id, position);

-- A device's ring. Cleared (not deleted) if the ring is removed.
alter table public.devices
  add column if not exists ring_id uuid references public.rings(id) on delete set null;

-- Portal writes/reads via the service-role client; the agent only needs
-- devices.ring_id (already readable), not the rings table itself.
grant all on public.rings to service_role;
