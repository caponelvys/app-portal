-- Windows .exe install support. Unlike .msi, .exe installers have no common
-- silent-install flag (NSIS /S, Inno /VERYSILENT, Squirrel -s, ...), so the admin
-- supplies the args per app. Blank defaults to /S in the agent.

alter table public.apps add column if not exists windows_install_args text;
