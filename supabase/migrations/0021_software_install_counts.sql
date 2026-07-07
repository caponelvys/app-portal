-- Fleet software rollup for /admin/monitor/software: distinct installed apps
-- with how many devices each is on. Aggregating in SQL (one grouped query)
-- keeps the fleet view scale-first — never pulls every device_software row into
-- the app to count in JS.
--
-- Org scoping mirrors device_version_counts: p_org_ids NULL = all orgs
-- (msp_admin); otherwise restrict to those orgs (msp_tech). The page does its
-- own RBAC and passes the scoped org ids, so — like the other agent-table RPCs —
-- execute is granted to service_role only and the page calls it via the
-- service-role client (device_software has no authenticated read policy).
--
-- total_count (a window count over the full grouped result) rides along on each
-- row so the page can paginate without a second round trip.

create or replace function public.software_install_counts(
  p_org_ids uuid[] default null,
  p_search  text    default null,
  p_limit   int     default 50,
  p_offset  int     default 0
)
returns table (
  name          text,
  publisher     text,
  device_count  bigint,
  version_count bigint,
  total_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select ds.name, ds.publisher, ds.device_id, ds.version
    from public.device_software ds
    where (p_org_ids is null or ds.org_id = any(p_org_ids))
      and (p_search is null or ds.name ilike '%' || p_search || '%')
  ),
  grouped as (
    select
      name,
      -- a representative publisher (they're consistent per app in practice)
      (array_agg(publisher) filter (where publisher is not null))[1] as publisher,
      count(distinct device_id) as device_count,
      count(distinct version)   as version_count
    from filtered
    group by name
  )
  select
    name, publisher, device_count, version_count,
    count(*) over() as total_count
  from grouped
  order by device_count desc, name asc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

grant execute on function public.software_install_counts(uuid[], text, int, int)
  to service_role;
