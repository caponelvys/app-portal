-- M2 CP3a: turn observed software into enforceable policy.
--
-- (1) device_software.process_name — the executable name the agent now reports
--     (macOS CFBundleExecutable, Windows DisplayIcon exe). It's the key the
--     enforcement path matches on, so capturing it lets the portal "promote" an
--     unmanaged app into a catalog entry the agent can act on.
-- (2) policy_rules — the CP3b foundation: publisher/path/name rules that resolve
--     against inventory into enforcement. Table lands now; batch authoring UI
--     follows. Portal-only (service-role); the agent enforces via materialized
--     catalog apps + app_policies, not by reading rules directly.
-- (3) software_install_counts gains a representative process_name so the promote
--     action has the enforcement key without a second query.

alter table public.device_software
  add column if not exists process_name text;

create table if not exists public.policy_rules (
  id          uuid primary key default gen_random_uuid(),
  scope_type  text not null check (scope_type in ('org','location','device')),
  scope_id    text not null,                              -- device_id (text) or org/location uuid
  match_type  text not null check (match_type in ('publisher','path','name')),
  match_value text not null,
  action      text not null check (action in ('allow','block')),
  org_id      uuid,                                       -- for scoping/audit
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_policy_rules_scope
  on public.policy_rules (scope_type, scope_id);

grant all on public.policy_rules to service_role;

-- Rebuild the fleet rollup to also surface a representative process_name.
drop function if exists public.software_install_counts(uuid[], text, text[], text, int, int);

create or replace function public.software_install_counts(
  p_org_ids       uuid[] default null,
  p_search        text   default null,
  p_managed_names text[] default null,
  p_filter        text   default null,
  p_limit         int    default 50,
  p_offset        int    default 0
)
returns table (
  name          text,
  publisher     text,
  process_name  text,
  device_count  bigint,
  version_count bigint,
  managed       boolean,
  total_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select ds.name, ds.publisher, ds.process_name, ds.device_id, ds.version
    from public.device_software ds
    where (p_org_ids is null or ds.org_id = any(p_org_ids))
      and (p_search is null or ds.name ilike '%' || p_search || '%')
  ),
  grouped as (
    select
      name,
      (array_agg(publisher)    filter (where publisher    is not null))[1] as publisher,
      (array_agg(process_name) filter (where process_name is not null))[1] as process_name,
      count(distinct device_id) as device_count,
      count(distinct version)   as version_count,
      (p_managed_names is not null and lower(name) = any(p_managed_names)) as managed
    from filtered
    group by name
  ),
  visible as (
    select * from grouped
    where p_filter is null
       or (p_filter = 'managed'   and managed)
       or (p_filter = 'unmanaged' and not managed)
  )
  select
    name, publisher, process_name, device_count, version_count, managed,
    count(*) over() as total_count
  from visible
  order by device_count desc, name asc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

grant execute on function
  public.software_install_counts(uuid[], text, text[], text, int, int)
  to service_role;
