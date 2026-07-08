-- M3 CP3: policy version history + rollback. Every scoped allow/block change
-- (org/location/device/ring) is appended here as old → new, so an admin can see
-- what changed, who changed it, and revert a bad change to its prior value.
-- Portal-only (service-role); the agent doesn't touch it.

create table if not exists public.policy_changes (
  id          uuid primary key default gen_random_uuid(),
  scope_type  text not null,                       -- org | location | device | ring
  scope_id    text not null,
  app_id      uuid references public.apps(id) on delete cascade,
  old_status  text,                                -- null = was inherited
  new_status  text,                                -- null = cleared to inherited
  org_id      uuid,                                -- for scoping the history list
  changed_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_policy_changes_org_created
  on public.policy_changes (org_id, created_at desc);

grant all on public.policy_changes to service_role;
