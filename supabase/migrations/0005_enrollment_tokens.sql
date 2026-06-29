-- Location enrollment tokens
-- Run in the Supabase SQL editor after 0004_app_policies.sql.
--
-- Each location gets a unique enrollment token. Agents installed with that
-- token self-assign to the location's org/location on registration, so they
-- inherit the right policies with no manual placement.

alter table public.locations add column if not exists enrollment_token text;

-- Backfill a token for any existing location that doesn't have one.
update public.locations
  set enrollment_token = 'loc_' || replace(gen_random_uuid()::text, '-', '')
  where enrollment_token is null;

create unique index if not exists locations_enrollment_token_idx
  on public.locations(enrollment_token);
