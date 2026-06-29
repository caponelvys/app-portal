-- Policy inheritance: Org default + Location/Device overrides
-- Run in the Supabase SQL editor after 0003_msp_hierarchy.sql.
--
-- The apps table stays the catalog and its `status` becomes the GLOBAL DEFAULT.
-- app_policies holds overrides at org / location / device scope. Effective
-- status for a device resolves most-specific-first:
--   device override > location override > org override > apps.status (global)

create table if not exists public.app_policies (
  id         uuid primary key default gen_random_uuid(),
  app_id     uuid not null references public.apps(id) on delete cascade,
  scope_type text not null check (scope_type in ('org', 'location', 'device')),
  scope_id   uuid not null,   -- polymorphic: an org / location / device id
  status     text not null check (status in ('allowed', 'blocked')),
  created_at timestamptz not null default now(),
  unique (app_id, scope_type, scope_id)
);

create index if not exists app_policies_scope_idx on public.app_policies(scope_id);
create index if not exists app_policies_app_idx   on public.app_policies(app_id);

alter table public.app_policies disable row level security;
