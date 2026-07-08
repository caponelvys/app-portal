-- Enforcement extension: USB / removable-storage control. A scope can block
-- removable storage; the agent (root/SYSTEM) enforces it — ejecting unauthorized
-- USB volumes on macOS, disabling the USBSTOR service on Windows. Resolves
-- most-specific-first (device > ring > location > org), defaulting to 'allow'.
-- NULL = inherit from the parent scope.

alter table public.orgs      add column if not exists removable_storage text;
alter table public.locations add column if not exists removable_storage text;
alter table public.rings     add column if not exists removable_storage text;
alter table public.devices   add column if not exists removable_storage text;

do $$
declare t text;
begin
  foreach t in array array['orgs','locations','rings','devices'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t||'_removable_storage_chk');
    execute format($f$alter table public.%I add constraint %I check (removable_storage in ('allow','block'))$f$, t, t||'_removable_storage_chk');
  end loop;
end $$;

-- Effective policy for a device, bypassing RLS so the anon-key agent can read
-- the whole hierarchy in one call. Precedence device > ring > location > org.
create or replace function public.effective_removable_storage(p_device_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(d.removable_storage, r.removable_storage, l.removable_storage, o.removable_storage, 'allow')
  from   public.devices d
  left join public.rings     r on r.id = d.ring_id
  left join public.locations l on l.id = d.location_id
  left join public.orgs      o on o.id = d.org_id
  where  d.device_id = p_device_id;
$$;

grant execute on function public.effective_removable_storage(text) to anon, service_role;
