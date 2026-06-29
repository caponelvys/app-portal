-- Secure device pairing via one-time codes.
-- Run this in the Supabase SQL editor AFTER 0001_app_access_requests.sql.
--
-- The agent writes a short pairing code onto its (unclaimed) device row and
-- displays it locally. The user enters that code in the portal to claim the
-- matching device. On a successful claim the code is cleared.

alter table public.devices
  add column if not exists pairing_code text;

create index if not exists devices_pairing_code_idx on public.devices(pairing_code);
