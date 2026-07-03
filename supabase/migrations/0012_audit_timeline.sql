-- Server-side pagination for Reports (/admin/audit). The page previously loaded
-- app_requests + agent_logs (each capped at 5000) and merged/sorted them into a
-- timeline in the browser. This view unifies the three event sources in the DB
-- so the page can filter/sort/paginate with an exact count and compute the stat
-- cards via a grouped RPC — no full-table loads.
--
-- org_id is derived (the base tables have none): a request's org is the
-- requester's (profiles.org_id); an enforcement event's org is the device's.
-- app / actor / detail are resolved here so text filters run in the DB; hostname
-- is cleaned with split_part (first label), approximating cleanHostname().

create or replace view public.audit_timeline as
-- Access-request submissions
select
  r.created_at as time,
  'request'::text as kind,
  reqp.org_id as org_id,
  coalesce(a.name, 'Unknown app') as app,
  coalesce(reqp.email, 'Unknown user') as actor,
  'requested ' || (case r.duration
    when '1h' then '1 hour' when '4h' then '4 hours'
    when '1d' then '1 day'  when '1w' then '1 week'
    when 'permanent' then 'permanent' else coalesce(r.duration, '') end) || ' access' as detail
from app_requests r
left join apps a on a.id = r.app_id
left join profiles reqp on reqp.id = r.user_id

union all
-- Request reviews (approved / denied / revoked)
select
  r.reviewed_at,
  r.status,
  reqp.org_id,
  coalesce(a.name, 'Unknown app'),
  coalesce(revp.email, 'admin'),
  r.status || ' access for ' || coalesce(reqp.email, 'Unknown user')
from app_requests r
left join apps a on a.id = r.app_id
left join profiles reqp on reqp.id = r.user_id
left join profiles revp on revp.id = r.reviewed_by
where r.reviewed_at is not null and r.status in ('approved', 'denied', 'revoked')

union all
-- Enforcement events (accessed / blocked)
select
  l.created_at,
  case when l.action = 'accessed' then 'accessed' else 'killed' end,
  d.org_id,
  l.app_name,
  coalesce(devp.email, nullif(split_part(coalesce(d.hostname, ''), '.', 1), ''), 'Unknown device'),
  (case when l.action = 'accessed' then 'used on ' else 'blocked on ' end)
    || coalesce(nullif(split_part(coalesce(d.hostname, ''), '.', 1), ''), 'a device')
from agent_logs l
left join devices d on d.device_id = l.device_id
left join profiles devp on devp.id = d.user_id;

grant select on public.audit_timeline to service_role;

-- Stat-card aggregates: counts per kind for the same filters as the table
-- (except kind itself, since the cards span all kinds). NULL args = unfiltered.
create or replace function public.audit_kind_counts(
  org_ids uuid[] default null,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_app text default null,
  p_actor text default null
) returns table(kind text, count bigint)
language sql
security definer
set search_path = public
as $$
  select kind, count(*)::bigint
  from audit_timeline
  where (org_ids  is null or org_id = any(org_ids))
    and (p_since  is null or time >= p_since)
    and (p_until  is null or time <= p_until)
    and (p_app    is null or app   ilike '%' || p_app   || '%')
    and (p_actor  is null or actor ilike '%' || p_actor || '%')
  group by kind;
$$;

grant execute on function public.audit_kind_counts(uuid[], timestamptz, timestamptz, text, text) to service_role;

-- Time indexes backing the timeline's ordering/range scans.
create index if not exists idx_agent_logs_created      on public.agent_logs   (created_at desc);
create index if not exists idx_app_requests_created     on public.app_requests (created_at desc);
create index if not exists idx_app_requests_reviewed    on public.app_requests (reviewed_at desc);
