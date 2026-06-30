-- Increment 5: Row-Level Security
-- Run in the Supabase SQL editor.
--
-- Security posture:
--   service_role key (used by createAdminClient) bypasses RLS entirely — no changes needed there.
--   anon key (used by the agent) is granted read access to the tables it needs.
--   authenticated JWT (used by the web app session) is filtered by the policies below.
--
-- Helper functions run as SECURITY DEFINER so they can read profiles/memberships
-- without triggering recursive RLS evaluation.

create or replace function public.is_msp_staff()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role = 'admin' or role_v2 in ('msp_admin', 'msp_tech')
     from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.caller_org_id()
returns uuid language sql security definer stable as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Returns every org the caller can access (own org + memberships).
create or replace function public.accessible_org_ids()
returns setof uuid language sql security definer stable as $$
  select org_id from public.profiles where id = auth.uid() and org_id is not null
  union
  select org_id from public.memberships where user_id = auth.uid()
$$;

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "msp staff read all profiles"
  on public.profiles for select
  using (public.is_msp_staff());

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- apps  (agent + web both need to read; no per-tenant scoping needed)
-- ─────────────────────────────────────────────
alter table public.apps enable row level security;

create policy "anyone can read apps"
  on public.apps for select
  using (true);

-- ─────────────────────────────────────────────
-- app_policies
-- ─────────────────────────────────────────────
alter table public.app_policies enable row level security;

create policy "anyone can read app_policies"
  on public.app_policies for select
  using (true);

-- ─────────────────────────────────────────────
-- orgs
-- ─────────────────────────────────────────────
alter table public.orgs enable row level security;

create policy "msp staff read all orgs"
  on public.orgs for select
  using (public.is_msp_staff());

create policy "members read own org"
  on public.orgs for select
  using (id = any(select public.accessible_org_ids()));

-- ─────────────────────────────────────────────
-- locations  (agent needs enrollment_token lookup)
-- ─────────────────────────────────────────────
alter table public.locations enable row level security;

create policy "anon can read locations"
  on public.locations for select
  using (auth.role() = 'anon');

create policy "msp staff read all locations"
  on public.locations for select
  using (public.is_msp_staff());

create policy "members read own org locations"
  on public.locations for select
  using (org_id = any(select public.accessible_org_ids()));

-- ─────────────────────────────────────────────
-- devices  (agent registers/updates via anon key)
-- ─────────────────────────────────────────────
alter table public.devices enable row level security;

create policy "anon can manage devices"
  on public.devices for all
  using (auth.role() = 'anon')
  with check (auth.role() = 'anon');

create policy "msp staff read all devices"
  on public.devices for select
  using (public.is_msp_staff());

create policy "members read own org devices"
  on public.devices for select
  using (org_id = any(select public.accessible_org_ids()));

-- ─────────────────────────────────────────────
-- app_requests
-- ─────────────────────────────────────────────
alter table public.app_requests enable row level security;

-- Agent checks grants for a device's user — anon reads all (status filtering is in agent logic)
create policy "anon can read app_requests"
  on public.app_requests for select
  using (auth.role() = 'anon');

create policy "users read own requests"
  on public.app_requests for select
  using (user_id = auth.uid());

create policy "users insert own requests"
  on public.app_requests for insert
  with check (user_id = auth.uid());

create policy "msp staff read all requests"
  on public.app_requests for select
  using (public.is_msp_staff());

-- ─────────────────────────────────────────────
-- agent_logs
-- ─────────────────────────────────────────────
alter table public.agent_logs enable row level security;

create policy "anon can insert agent_logs"
  on public.agent_logs for insert
  with check (auth.role() = 'anon');

create policy "authenticated can read agent_logs"
  on public.agent_logs for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- memberships  (service role only — no user-facing policies)
-- ─────────────────────────────────────────────
alter table public.memberships enable row level security;

-- msp_admin can read memberships (for managing tech assignments)
create policy "msp staff read memberships"
  on public.memberships for select
  using (public.is_msp_staff());
