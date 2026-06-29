-- App access requests + per-user/per-device temporary grants
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Model: a user requests access to a blocked app for a chosen duration.
-- An admin approves/denies. On approval, expires_at is set (null = permanent).
-- The agent resolves the device's owning user and skips killing apps that have
-- an active approved grant for that user.

-- 1. Link a device to the user who claimed it (nullable until claimed).
alter table public.devices
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2. Access requests / grants.
create table if not exists public.app_requests (
  id          uuid primary key default gen_random_uuid(),
  app_id      uuid not null references public.apps(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text,
  duration    text not null default 'permanent',  -- '1h' | '4h' | '1d' | '1w' | 'permanent'
  status      text not null default 'pending',     -- 'pending' | 'approved' | 'denied'
  expires_at  timestamptz,                          -- set on approval; null = permanent
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists app_requests_user_idx   on public.app_requests(user_id);
create index if not exists app_requests_status_idx on public.app_requests(status);
create index if not exists app_requests_app_idx     on public.app_requests(app_id);

-- 3. RLS is disabled here to match the existing apps/devices tables (the agent
--    reads with the anon key, and privileged web operations are gated in the
--    API routes via createAdminClient + an admin role check). Tighten later if
--    you move to per-table RLS policies.
alter table public.app_requests disable row level security;
