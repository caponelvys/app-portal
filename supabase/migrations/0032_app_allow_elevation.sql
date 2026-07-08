-- Enforcement extension: elevation control. Admins designate which catalog apps
-- may be run elevated; a standard user can then be granted an elevated launch of
-- one of those apps on demand (the root/SYSTEM agent starts it with elevated
-- rights) without being made a local admin. This flag gates eligibility — only
-- apps with allow_elevation = true can be elevated.

alter table public.apps
  add column if not exists allow_elevation boolean not null default false;
