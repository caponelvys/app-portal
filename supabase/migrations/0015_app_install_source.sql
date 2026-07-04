-- Remote app install (admin-provided installer URLs). Reuses the device_commands
-- queue (type 'install_app') and its existing anon RLS policies from 0014 — no
-- new command-table changes needed. Just adds the per-app install source.
--
-- v1 covers macOS .pkg only; Windows (.msi url) / Linux (linux_package) install
-- columns will be added when those agent paths are built.

alter table public.apps add column if not exists mac_install_url text;  -- HTTPS URL to a .pkg installer
