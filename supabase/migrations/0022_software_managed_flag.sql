-- M2 CP1: flag fleet software as "managed" (in the app catalog) or not, so
-- admins can see what's running across the fleet that they aren't managing yet
-- — the observe half of learning mode.
--
-- Managed-ness is computed against the catalog app names the caller passes in
-- (p_managed_names, lowercased). The catalog is small, so keeping the name list
-- in the app avoids a brittle in-SQL name join and lets the matching rule evolve
-- without another migration. Filtering + pagination stay in SQL so the managed
-- filter is correct across pages.
--
-- Replaces the 0021 signature. The new params default, so the previously
-- deployed page (which passes only org/search/limit/offset) keeps working
-- through the deploy window.

drop function if exists public.software_install_counts(uuid[], text, int, int);

create or replace function public.software_install_counts(
  p_org_ids       uuid[] default null,
  p_search        text   default null,
  p_managed_names text[] default null,   -- lowercased catalog app names
  p_filter        text   default null,   -- 'managed' | 'unmanaged' | null (all)
  p_limit         int    default 50,
  p_offset        int    default 0
)
returns table (
  name          text,
  publisher     text,
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
    select ds.name, ds.publisher, ds.device_id, ds.version
    from public.device_software ds
    where (p_org_ids is null or ds.org_id = any(p_org_ids))
      and (p_search is null or ds.name ilike '%' || p_search || '%')
  ),
  grouped as (
    select
      name,
      (array_agg(publisher) filter (where publisher is not null))[1] as publisher,
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
    name, publisher, device_count, version_count, managed,
    count(*) over() as total_count
  from visible
  order by device_count desc, name asc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

grant execute on function
  public.software_install_counts(uuid[], text, text[], text, int, int)
  to service_role;
