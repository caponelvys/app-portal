-- Harden enrollment token access.
-- The agent now uses /api/enroll (service role) instead of querying locations
-- directly, so the anon key no longer needs to read enrollment_token.
--
-- Drop the broad anon read policy on locations and replace it with a
-- restricted one that excludes the enrollment_token column.
-- (The agent no longer queries locations at all — this is belt-and-suspenders.)

drop policy if exists "anon can read locations" on public.locations;

-- Anon can still read id/org_id/name for the heartbeat path, but
-- enrollment_token is only accessible via the service-role API route.
-- Since Postgres RLS operates at row level (not column level), we instead
-- simply remove anon access to locations entirely — the agent no longer needs it.
-- Column-level security is a separate Postgres feature; for full protection,
-- revoke direct column access from the anon role.

revoke select on public.locations from anon;
grant select (id, name, org_id) on public.locations to anon;
