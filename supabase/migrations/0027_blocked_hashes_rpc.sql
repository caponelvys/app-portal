-- Parked item: true per-build hash enforcement. Hash BLOCK rules no longer
-- materialize into app-level policies (the portal now skips them) — instead the
-- agent enforces them per build: it hashes running app binaries and kills only
-- the ones whose sha256 matches, so a bad build is blocked while newer builds
-- keep running.
--
-- This resolver returns the set of blocked build hashes that apply to a device,
-- across org / location / device scope (ring scope arrives with M3 CP2).
-- SECURITY DEFINER + anon so the agent can call it; the list is tiny.

create or replace function public.blocked_hashes_for_device(p_device_id text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct lower(pr.match_value)
  from   public.policy_rules pr
  join   public.devices d on d.device_id = p_device_id
  where  pr.match_type = 'hash'
    and  pr.action = 'block'
    and  (
         (pr.scope_type = 'org'      and pr.scope_id = d.org_id::text)
      or (pr.scope_type = 'location' and pr.scope_id = d.location_id::text)
      or (pr.scope_type = 'device'   and pr.scope_id = d.device_id)
    );
$$;

grant execute on function public.blocked_hashes_for_device(text) to anon, service_role;
