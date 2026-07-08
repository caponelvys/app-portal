-- Security hardening (tenant isolation). Two confirmed cross-tenant holes,
-- both reachable with the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, which
-- ships in the browser bundle and the agent):
--
-- (1) CREATE FUNCTION grants EXECUTE to PUBLIC by default, so the "service_role
--     only" reporting RPCs were actually callable by anon/authenticated — and
--     being SECURITY DEFINER they bypass RLS. Passing p_org_ids => NULL returned
--     every tenant's data. Fix: revoke EXECUTE from PUBLIC (and anon/authenticated)
--     so only the service-role portal client can call them.
--
-- (2) device_software granted anon SELECT with a blanket auth.role()='anon'
--     policy, so anyone with the anon key could read the whole fleet's inventory
--     (incl. install paths that embed usernames). The agent never SELECTs this
--     table (it computes its diff locally), so anon SELECT is safe to remove.
--     NOTE: anon still has INSERT/UPDATE/DELETE for the agent's upsert + stale-
--     prune — that write path is only bound by auth.role()='anon' (shared by all
--     agent tables) and wants a per-device identity model; tracked separately.

-- (1a) Reporting RPCs → service-role only.
revoke execute on function public.software_install_counts(uuid[], text, text[], text, int, int) from public, anon, authenticated;
revoke execute on function public.usage_by_org(uuid[], timestamptz) from public, anon, authenticated;
revoke execute on function public.audit_kind_counts(uuid[], timestamptz, timestamptz, text, text) from public, anon, authenticated;

-- (1b) Agent resolver RPCs → agent (anon) + service-role only; drop the implicit
--      PUBLIC/authenticated access. (These keep their explicit grant to anon.)
revoke execute on function public.effective_enforcement_mode(text) from public, authenticated;
revoke execute on function public.blocked_hashes_for_device(text) from public, authenticated;
revoke execute on function public.effective_removable_storage(text) from public, authenticated;

-- (2) device_software: remove anon read (leaves the agent's write path intact).
revoke select on public.device_software from anon;
drop policy if exists "anon reads device_software" on public.device_software;
