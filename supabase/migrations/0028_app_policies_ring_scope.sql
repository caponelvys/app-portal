-- M3 CP2: ring becomes a policy scope. A policy set on a rollout ring applies to
-- every device in that ring, sitting above location/org in the resolver
-- (device > ring > location > org). Agent v1.7.22 reads devices.ring_id and
-- factors ring policies into resolution.

alter table public.app_policies drop constraint if exists app_policies_scope_type_check;
alter table public.app_policies add  constraint app_policies_scope_type_check
  check (scope_type in ('org','location','device','ring'));
