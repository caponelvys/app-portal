-- Grouped device-count RPCs so dashboard/list pages get exact aggregates in one
-- indexed query instead of loading every device row (which Supabase caps at
-- 1000, silently undercounting large fleets).
--
-- Health-tier thresholds mirror lib/deviceStatus.ts: healthy <2m, inactive
-- <14d, warning <30d, stale <90d, else lost; null last_seen = never.
--
-- Each function takes an optional org_ids filter (NULL = all orgs) so the app
-- can apply msp_tech org-scoping. SECURITY DEFINER + execute granted to
-- service_role only (pages call via the server-side admin client).

create or replace function public.device_health_counts(org_ids uuid[] default null)
returns table(tier text, count bigint)
language sql
security definer
set search_path = public
as $$
  select
    case
      when last_seen is null then 'never'
      when now() - last_seen < interval '2 minutes'  then 'healthy'
      when now() - last_seen < interval '14 days'    then 'inactive'
      when now() - last_seen < interval '30 days'    then 'warning'
      when now() - last_seen < interval '90 days'    then 'stale'
      else 'lost'
    end as tier,
    count(*)::bigint
  from devices
  where org_ids is null or org_id = any(org_ids)
  group by 1;
$$;

create or replace function public.device_version_counts(org_ids uuid[] default null)
returns table(agent_version text, count bigint)
language sql
security definer
set search_path = public
as $$
  select coalesce(agent_version, 'unknown') as agent_version, count(*)::bigint
  from devices
  where org_ids is null or org_id = any(org_ids)
  group by 1;
$$;

create or replace function public.org_device_counts(org_ids uuid[] default null)
returns table(org_id uuid, total bigint, healthy bigint)
language sql
security definer
set search_path = public
as $$
  select org_id,
         count(*)::bigint as total,
         count(*) filter (where last_seen is not null and now() - last_seen < interval '2 minutes')::bigint as healthy
  from devices
  where org_id is not null and (org_ids is null or org_id = any(org_ids))
  group by org_id;
$$;

create or replace function public.location_device_counts(org_ids uuid[] default null)
returns table(location_id uuid, total bigint, healthy bigint)
language sql
security definer
set search_path = public
as $$
  select location_id,
         count(*)::bigint as total,
         count(*) filter (where last_seen is not null and now() - last_seen < interval '2 minutes')::bigint as healthy
  from devices
  where location_id is not null and (org_ids is null or org_id = any(org_ids))
  group by location_id;
$$;

grant execute on function public.device_health_counts(uuid[])   to service_role;
grant execute on function public.device_version_counts(uuid[])  to service_role;
grant execute on function public.org_device_counts(uuid[])      to service_role;
grant execute on function public.location_device_counts(uuid[]) to service_role;
