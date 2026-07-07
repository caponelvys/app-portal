-- M2 CP2: learning mode. A scope in 'learn' mode is observed but not enforced —
-- the agent records what it WOULD block instead of killing, so an admin can
-- watch for a couple of weeks before committing to 'enforce'. Mode resolves
-- most-specific-first (device > location > org), defaulting to 'enforce' when
-- unset everywhere. NULL = inherit from the parent scope.

alter table public.orgs      add column if not exists enforcement_mode text;
alter table public.locations add column if not exists enforcement_mode text;
alter table public.devices   add column if not exists enforcement_mode text;

-- Only 'enforce' | 'learn' when set; NULL (inherit) still allowed.
alter table public.orgs      drop constraint if exists orgs_enforcement_mode_chk;
alter table public.orgs      add  constraint orgs_enforcement_mode_chk
  check (enforcement_mode in ('enforce','learn'));
alter table public.locations drop constraint if exists locations_enforcement_mode_chk;
alter table public.locations add  constraint locations_enforcement_mode_chk
  check (enforcement_mode in ('enforce','learn'));
alter table public.devices   drop constraint if exists devices_enforcement_mode_chk;
alter table public.devices   add  constraint devices_enforcement_mode_chk
  check (enforcement_mode in ('enforce','learn'));

-- The agent (anon key) can't read orgs/locations under RLS, so it can't resolve
-- the hierarchy by itself. This SECURITY DEFINER resolver returns the effective
-- mode for a device in one call, bypassing RLS without exposing org/location
-- rows. Granted to anon (agent) and service_role (portal).
create or replace function public.effective_enforcement_mode(p_device_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(d.enforcement_mode, l.enforcement_mode, o.enforcement_mode, 'enforce')
  from   public.devices d
  left join public.locations l on l.id = d.location_id
  left join public.orgs      o on o.id = d.org_id
  where  d.device_id = p_device_id;
$$;

grant execute on function public.effective_enforcement_mode(text) to anon, service_role;
