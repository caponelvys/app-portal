-- Per-device auth model for the agent (closes the #1 deferred security item).
--
-- BEFORE: every agent-written table (devices, agent_logs, agent_events,
-- device_software, device_commands) and read path (resolver RPCs, app_policies,
-- app_requests, apps) was gated only by auth.role()='anon'. The anon key is
-- public (browser bundle + hardcoded in agent.py), so anyone could write ANY
-- device's rows cross-tenant, and the resolver RPCs took an arbitrary p_device_id
-- so anyone could read ANY device's policy posture.
--
-- AFTER: enrollment mints a per-device bearer token (sha256 stored in
-- devices.token_hash). The agent sends it to /api/agent/sync and /api/enroll;
-- the server derives the device from token_hash (never trusts a body device_id)
-- and does every read/write via the service-role client. anon loses all access
-- to the agent surface.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ APPLY IN TWO STEPS.                                                         │
-- │  • PART 1 (columns) — apply FIRST, before deploying the new agent. Adding   │
-- │    the column is backward-compatible; nothing breaks.                       │
-- │  • PART 2 (the flip) — apply LAST, only AFTER the token-aware agent is       │
-- │    deployed to /api/agent/version + public/downloads AND the fleet has       │
-- │    updated + re-enrolled to obtain tokens. It revokes anon access, so any    │
-- │    agent still on the old code goes dark until it auto-updates (~5 min via   │
-- │    /api/agent/version, which stays unauthenticated) and re-enrolls.          │
-- └──────────────────────────────────────────────────────────────────────────┘

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — device token column (apply first, non-breaking)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.devices add column if not exists token_hash      text;
alter table public.devices add column if not exists token_issued_at timestamptz;

-- One token per device; partial index so pre-token rows (NULL) don't collide.
create unique index if not exists devices_token_hash_uidx
  on public.devices (token_hash) where token_hash is not null;


-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — THE FLIP: remove anon access to the agent surface.
-- Apply LAST (see the banner above). Everything the agent needs now goes through
-- /api/agent/* (service-role). service_role bypasses RLS, so the portal + the new
-- endpoints are unaffected; only the public anon role loses access.
-- ════════════════════════════════════════════════════════════════════════════

-- devices — was: "anon can manage devices" (FOR ALL). Portal keeps its
-- msp-staff / member / service-role paths.
drop policy if exists "anon can manage devices" on public.devices;
revoke all on public.devices from anon;

-- agent_logs — was: anon INSERT (grant + policy).
drop policy if exists "anon can insert agent_logs" on public.agent_logs;
revoke all on public.agent_logs from anon;

-- agent_events — anon INSERT was granted ad-hoc (RLS disabled on this table),
-- so revoke the grant and defensively drop any policy.
drop policy if exists "anon can insert agent_events" on public.agent_events;
drop policy if exists "anon inserts agent_events"     on public.agent_events;
revoke all on public.agent_events from anon;

-- device_software — was: anon INSERT/UPDATE/DELETE (0020); 0035 already removed
-- the read. Drop the remaining write policies + grants.
drop policy if exists "anon inserts device_software" on public.device_software;
drop policy if exists "anon updates device_software" on public.device_software;
drop policy if exists "anon deletes device_software" on public.device_software;
revoke all on public.device_software from anon;

-- device_commands — was: anon SELECT/UPDATE (0013/0014).
drop policy if exists "anon reads device_commands"   on public.device_commands;
drop policy if exists "anon updates device_commands" on public.device_commands;
revoke all on public.device_commands from anon;

-- app_requests — was: "anon can read app_requests" (grant check happens server-side now).
drop policy if exists "anon can read app_requests" on public.app_requests;
revoke all on public.app_requests from anon;

-- apps / app_policies — were world-readable (using(true)), so anon could read
-- every tenant's block map. The agent no longer reads them directly; the portal
-- reads them as an authenticated user (client) or service_role (server). Restrict
-- to authenticated + service_role; drop the public/anon read.
drop policy if exists "anyone can read apps" on public.apps;
create policy "authenticated can read apps"
  on public.apps for select
  using (auth.role() = 'authenticated');
revoke select on public.apps from anon;

drop policy if exists "anyone can read app_policies" on public.app_policies;
create policy "authenticated can read app_policies"
  on public.app_policies for select
  using (auth.role() = 'authenticated');
revoke select on public.app_policies from anon;

-- Agent resolver RPCs — SECURITY DEFINER, previously anon-callable with an
-- arbitrary p_device_id. Only the sync endpoint (service_role) calls them now,
-- with the token-derived device_id.
revoke execute on function public.effective_enforcement_mode(text)  from anon;
revoke execute on function public.blocked_hashes_for_device(text)   from anon;
revoke execute on function public.effective_removable_storage(text) from anon;

-- locations — anon column-grant (id,name,org_id) from 0008 was belt-and-suspenders
-- for a path the agent no longer uses (enroll resolves the token server-side).
revoke select on public.locations from anon;
drop policy if exists "anon can read locations" on public.locations;
