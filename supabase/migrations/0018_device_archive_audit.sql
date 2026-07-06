-- Keep enforcement history readable after a device is deleted, and show the
-- DEVICE NAME (not the owner's email) in the Reports timeline's actor column.
--
-- Deleting a device (self-uninstall or the manual ⋯ → Delete) hard-removes its
-- devices row. The audit_timeline view LEFT JOINs devices, so every past
-- Blocked/Accessed event for a deleted device turned into "Unknown device" and
-- lost its org_id (which also hid the rows from org-scoped staff, since the page
-- filters on org_id). We now snapshot the device's identity into device_archive
-- on delete and resolve the timeline from devices ∪ archive.

-- device_id is TEXT to match agent_logs.device_id / devices.device_id (both text,
-- despite looking like UUIDs). org_id is uuid to match devices.org_id.
create table if not exists public.device_archive (
  device_id  text primary key,
  hostname   text,
  org_id     uuid,
  deleted_at timestamptz not null default now()
);
-- Fix an earlier draft that created device_id as uuid (table is empty → safe;
-- no-op once it's already text, so this stays idempotent on fresh DBs).
alter table public.device_archive alter column device_id type text using device_id::text;
grant select, insert, update on public.device_archive to service_role;
-- RLS on with no policies → anon/authenticated denied; service_role bypasses RLS,
-- so the admin-client reads/writes (archiveDevice, resolveDeviceNames) still work.
-- This table holds fleet device names + org ids and must not be world-readable.
alter table public.device_archive enable row level security;

-- Redefine the unified timeline. Column list/order/types are unchanged so the
-- dependent audit_kind_counts() function stays valid.
create or replace view public.audit_timeline as
-- Access-request submissions (a user action — no device; actor left blank)
select
  r.created_at as time,
  'request'::text as kind,
  reqp.org_id as org_id,
  coalesce(a.name, 'Unknown app') as app,
  ''::text as actor,
  'requested ' || (case r.duration
    when '1h' then '1 hour' when '4h' then '4 hours'
    when '1d' then '1 day'  when '1w' then '1 week'
    when 'permanent' then 'permanent' else coalesce(r.duration, '') end) || ' access' as detail
from app_requests r
left join apps a on a.id = r.app_id
left join profiles reqp on reqp.id = r.user_id

union all
-- Request reviews (approved / denied / revoked) (a user action — no device)
select
  r.reviewed_at,
  r.status,
  reqp.org_id,
  coalesce(a.name, 'Unknown app'),
  ''::text,
  r.status || ' access for ' || coalesce(reqp.email, 'Unknown user')
from app_requests r
left join apps a on a.id = r.app_id
left join profiles reqp on reqp.id = r.user_id
where r.reviewed_at is not null and r.status in ('approved', 'denied', 'revoked')

union all
-- Enforcement events (accessed / blocked) — resolve the device from the live
-- table first, then the archive; show the device name, never the owner's email.
select
  l.created_at,
  case when l.action = 'accessed' then 'accessed' else 'killed' end,
  coalesce(d.org_id, da.org_id),
  l.app_name,
  coalesce(nullif(split_part(coalesce(d.hostname, da.hostname, ''), '.', 1), ''), 'Unknown device'),
  (case when l.action = 'accessed' then 'used on ' else 'blocked on ' end)
    || coalesce(nullif(split_part(coalesce(d.hostname, da.hostname, ''), '.', 1), ''), 'a device')
from agent_logs l
left join devices d on d.device_id = l.device_id
left join device_archive da on da.device_id = l.device_id;

grant select on public.audit_timeline to service_role;
