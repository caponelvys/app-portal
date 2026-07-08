-- Reporting & integration: per-endpoint usage metering for billing. MSPs bill
-- per managed endpoint per month, so we track, per org, total enrolled devices
-- and "active" devices (those that checked in during the period). Live counts
-- come from usage_by_org; monthly snapshots give an auditable billing history.
-- Portal-only (service-role).

create table if not exists public.usage_snapshots (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.orgs(id) on delete cascade,
  period       text not null,                 -- 'YYYY-MM'
  device_count int  not null,                 -- enrolled at capture
  active_count int  not null,                 -- checked in during the period
  captured_at  timestamptz not null default now(),
  unique (org_id, period)
);
create index if not exists idx_usage_snapshots_period on public.usage_snapshots (period);

grant all on public.usage_snapshots to service_role;

-- Grouped device counts per org: total, and active since p_active_since. One
-- query instead of a count per org (scale-first). p_org_ids NULL = all orgs.
create or replace function public.usage_by_org(p_org_ids uuid[], p_active_since timestamptz)
returns table (org_id uuid, total bigint, active bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d.org_id,
         count(*)::bigint,
         count(*) filter (where d.last_seen >= p_active_since)::bigint
  from   public.devices d
  where  d.org_id is not null
    and  (p_org_ids is null or d.org_id = any(p_org_ids))
  group by d.org_id;
$$;

grant execute on function public.usage_by_org(uuid[], timestamptz) to service_role;
