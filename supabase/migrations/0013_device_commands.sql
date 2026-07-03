-- Remote app-uninstall: a queue of commands the portal issues to a device's
-- agent. Separate from devices.pending_command (which carries the single-slot
-- agent-lifecycle commands restart/update/uninstall-agent) because an app
-- uninstall must name an app, may be queued in bulk (fleet-wide = one row per
-- device), and needs a per-command result written back.

create table if not exists public.device_commands (
  id         uuid primary key default gen_random_uuid(),
  device_id  text not null,                              -- matches devices.device_id
  type       text not null,                              -- 'uninstall_app' (extensible)
  app_id     uuid references public.apps(id) on delete set null,
  status     text not null default 'pending',            -- pending | running | done | failed
  result     text,                                       -- detail written back by the agent
  org_id     uuid,                                       -- device's org at queue time (scoping/audit)
  created_by uuid,                                       -- profile that issued it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The agent polls only its own pending commands.
create index if not exists idx_device_commands_pending
  on public.device_commands (device_id) where status = 'pending';
-- Portal reads recent command history per device.
create index if not exists idx_device_commands_device_created
  on public.device_commands (device_id, created_at desc);

-- Access model mirrors the other agent tables (RLS off; grants only — see the
-- deferred RLS pass). Portal uses the service-role client; the agent reads its
-- queue and writes results with the anon key.
grant all on public.device_commands to service_role;
grant select, update on public.device_commands to anon;

-- Optional per-app uninstall overrides ("metadata later"). When set, the agent
-- uses these instead of its per-OS heuristics.
alter table public.apps add column if not exists mac_app_path    text;  -- e.g. /Applications/Discord.app
alter table public.apps add column if not exists windows_uninstall text; -- winget id or Add/Remove display name
alter table public.apps add column if not exists linux_package   text;  -- package name for apt/dnf/snap/flatpak
