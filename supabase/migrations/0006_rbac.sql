-- RBAC: role_v2, org membership, and memberships table.
-- Run in the Supabase SQL editor.

-- Add new role column to profiles (keeps legacy `role` intact for now)
alter table public.profiles
  add column if not exists org_id   uuid references public.orgs(id) on delete set null,
  add column if not exists role_v2  text not null default 'client_user'
    check (role_v2 in ('msp_admin', 'msp_tech', 'client_admin', 'client_user'));

-- Migrate existing users: admins → msp_admin, everyone else → client_user
update public.profiles
  set role_v2 = case when role = 'admin' then 'msp_admin' else 'client_user' end
  where role_v2 = 'client_user';

-- Memberships: MSP techs can be assigned to specific orgs
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references public.orgs(id) on delete cascade,
  unique(user_id, org_id)
);
create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_org_idx  on public.memberships(org_id);

alter table public.memberships disable row level security;

-- Grant access
grant all on public.memberships to authenticated;
grant all on public.memberships to service_role;
grant all on public.profiles    to service_role;
