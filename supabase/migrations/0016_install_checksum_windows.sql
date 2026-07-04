-- Extend remote install: Windows .msi source + optional SHA-256 checksums.
-- Checksums are enforced only when set (optional hardening) — the agent verifies
-- the downloaded installer's digest before running it.

alter table public.apps add column if not exists windows_install_url    text;  -- HTTPS URL to a .msi
alter table public.apps add column if not exists mac_install_sha256     text;  -- optional hex sha256 of the .pkg
alter table public.apps add column if not exists windows_install_sha256 text;  -- optional hex sha256 of the .msi
