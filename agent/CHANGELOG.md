# App Controller Agent — Changelog

## v1.7.1 — 2026-07-04
- Windows remote install handles .exe installers in addition to .msi. The agent
  detects the format by magic bytes: an OLE .msi installs machine-wide via
  `msiexec /i /quiet /norestart` (as SYSTEM); a PE .exe runs in the logged-in
  user's session via a one-shot scheduled task (interactive token) so per-user
  installers (Discord/Slack/Teams) land in the user's profile. .exe installers
  have no common silent flag, so `windows_install_args` is set per app (defaults
  to `/S`). UNTESTED on real Windows hardware.

## v1.7.0 — 2026-07-04
- Windows agent can be packaged as a standalone .exe (PyInstaller) so target
  machines need no Python. The agent detects `sys.frozen` and, when frozen,
  self-updates by downloading the latest AppControllerAgent.exe from the GitHub
  release, renaming the running exe aside, swapping the new one in, and restarting
  (Windows allows renaming a running exe). A byte-identical release is skipped to
  avoid an update loop while CI is still publishing. macOS/Linux keep the agent.py
  swap path unchanged. The .exe is built by a GitHub Actions workflow
  (.github/workflows/build-agent-exe.yml).

## v1.6.3 — 2026-07-04
- macOS install is now format-detected by content, not URL/extension (installer
  URLs are usually redirects that don't end in .pkg/.dmg). xar → .pkg; PK → .zip
  app bundle (unpacked with `ditto -x -k`, which preserves perms/symlinks, then
  the .app is copied to /Applications); an HTML body is rejected; anything else
  is handed to `hdiutil` to mount as a disk image (.dmg/.iso/UDIF, any layout).
  This covers many more apps (Firefox's ISO image, VS Code/iTerm zips, etc.). The
  portal now auto-fills installer URLs for ~25 recognized apps.

## v1.6.2 — 2026-07-04
- macOS remote install supports .dmg in addition to .pkg. For a drag-to-
  Applications image (Notion, etc.) the agent mounts it (`hdiutil attach`), copies
  the first .app bundle into /Applications (`ditto`, replacing any existing one),
  and unmounts. Format is auto-detected (xar → .pkg, koly trailer or .dmg URL →
  .dmg); checksum verification still applies before anything is mounted.

## v1.6.1 — 2026-07-03
- Remote install extended to Windows .msi (`msiexec /i /quiet /norestart`,
  installs machine-wide as SYSTEM) alongside macOS .pkg, and now verifies an
  optional SHA-256 checksum on the downloaded installer before running it. A
  configured checksum that doesn't match is a hard failure — the installer is
  never run. Set `windows_install_url` / `windows_install_sha256` /
  `mac_install_sha256` on the app. Windows .msi path untested on real hardware.

## v1.6.0 — 2026-07-03
- Remote app install (macOS). The agent handles a new `install_app` command from
  the device_commands queue: it downloads the app's admin-provided `mac_install_url`,
  validates it's a real flat package (xar magic bytes, not an HTML error page),
  installs it silently with `installer -pkg <file> -target /` (runs as root),
  writes the result back, logs `install_app`/`install_failed`, and notifies the
  user. v1 is macOS .pkg only; Windows (.msi) and Linux install come later.

## v1.5.5 — 2026-07-03
- Windows remote uninstall handles per-user apps (Discord/Slack/Teams). These
  install into the user's profile and register in the user's HKCU, invisible to
  the SYSTEM service. When the machine-wide (HKLM) lookup misses, the agent runs
  the uninstall in the logged-in user's own session via a one-shot scheduled task
  with an interactive token (no stored password): a PowerShell script finds the
  app in HKCU and runs its QuietUninstallString, writing a result the agent reads
  back, then the task is deleted. Best-effort; requires validation on real
  Windows hardware (the /IT no-password task creation is the key assumption).

## v1.5.4 — 2026-07-03
- Windows remote uninstall made functional. `winget` isn't usable from the
  agent's SYSTEM service, so the agent now falls back to the app's registered
  silent uninstall string: it scans the HKLM Uninstall keys (64- and 32-bit) for
  a matching DisplayName and runs its QuietUninstallString (or the UninstallString,
  coercing MSI `/I` → `/X /quiet /norestart`). Reliable for machine-wide installs.
  Per-user installs (Discord/Slack/Teams register under the user's HKCU) aren't
  visible to SYSTEM — use a `windows_uninstall` override or a machine-wide build.
  Linux flatpak apps need their reverse-DNS id set as `linux_package`.

## v1.5.3 — 2026-07-03
- Remote app uninstall. The agent polls a `device_commands` queue and runs
  portal-issued `uninstall_app` commands: it kills the app, then removes it —
  macOS deletes the `/Applications/<App>.app` bundle (path-validated: only a
  bundle directly under /Applications), Windows uses `winget uninstall`, Linux
  uses the available package manager (apt/dnf/snap/flatpak). It writes the
  outcome (`done`/`failed` + detail) back to the command row, logs an
  `uninstall_app` / `uninstall_failed` event, and notifies the user. Uses the
  optional per-app catalog overrides (`mac_app_path` / `windows_uninstall` /
  `linux_package`) when set, otherwise best-effort heuristics from the app name.
  Best-effort throughout — a failure never disrupts enforcement.

## v1.5.2 — 2026-07-03
- Notifies the logged-in user when a blocked app is closed, so it doesn't just
  vanish silently: "<App> is blocked by your administrator and has been closed."
  The agent runs as root/SYSTEM, so the notification is dispatched into the
  console user's session (macOS `launchctl asuser … osascript`, Linux
  `sudo -u … notify-send`, Windows `msg`). Throttled per app (`NOTIFY_INTERVAL`,
  60s) so a relaunch loop can't spam banners. macOS/Linux show a banner; Windows
  shows a message box (no reliable toast from session 0). Best-effort — a
  notification failure never disrupts enforcement.

## v1.5.1 — 2026-07-03
- Transient network blips no longer create error events. A single failed poll
  (timeout / connection reset) self-heals on the next 5s cycle, so it's printed
  to the local log but not reported. Only a sustained outage — `NET_FAIL_ESCALATE`
  (3) consecutive failed checks — is logged as an error (still throttled). Real,
  non-network faults are unchanged (reported immediately). Stops the Agent
  Monitor from flagging normal connectivity hiccups as problems.

## v1.5.0 — 2026-07-01
- Executes portal-issued commands polled from `devices.pending_command` each
  cycle: `restart` (re-exec), `update` (self-update to latest), `uninstall`
  (remove service + installed files and stop). The command is cleared before it
  runs so it executes at most once.

## v1.4.0 — 2026-07-01
- Reports the logged-in OS username (`device_user`) on every heartbeat, detected
  via the console/active session (agent runs as root/SYSTEM): macOS
  `stat -f%%Su /dev/console`, Linux `who`, Windows `quser`/WMI. Shown on the
  device page so you can see who's using a machine without pairing.

## v1.3.1 — 2026-06-30
- Verification build to exercise the auto-update path end-to-end (no functional change)

## v1.3.0 — 2026-06-30
- Auto-update: the agent polls `/api/agent/version` every 5 min and, when a newer
  version is published, downloads it, validates it (reject HTML, compile-check,
  confirm the advertised version), backs up the current agent, and re-execs into
  the new version — no manual per-device update needed
- A bad download is rejected before the running agent is touched, so auto-update
  can never brick the agent

## v1.2.1 — 2026-06-30
- Fixed enrollment: `register_device` was posting to `/devices/api/enroll`
  (PORTAL_URL had been repurposed for the pairing display URL), which redirected
  to login and returned 405 — so `--token` enrollment silently failed. Split the
  pairing display URL into `PAIRING_URL`; enrollment now posts to `/api/enroll`.

## v1.2.0 — 2026-06-30
- Agent now reports structured activity events to `agent_events` (started,
  enrolled, paired, errors) — shown in the portal's per-device Activity log
- Repeated errors are throttled (max once per 5 min per distinct message) so the
  activity log stays readable instead of filling with duplicate spam

## v1.1.1 — 2026-06-30
- Installers/updaters now download `agent.py` to a temp file and validate it
  (reject HTML error pages, `python -m py_compile` check) before replacing the
  installed agent — a bad download (deploy race, wrong URL) can no longer
  overwrite the agent with garbage and crash-loop it
- Updates back up the current agent to `agent.py.bak` and roll back if the new
  agent fails to start
- Added dedicated update scripts: `update_mac.sh`, `update_linux.sh`, `update_win.bat`

## v1.1.0 — 2026-06-29
- Added `agent_version` field sent on every heartbeat — visible in All Devices table
- Added `ip_address` field sent on every heartbeat — shows last known local IP
- Added `get_local_ip()` helper using outbound socket to reliably detect local IP

## v1.0.0 — 2026-06-01
- Initial release
- Heartbeat every 5 seconds to update `last_seen`
- App enforcement: kills blocked processes based on org/location/device policies
- Enrollment via token (`--token` flag) to auto-assign device to a location
- Device pairing code displayed in terminal for user self-enrollment
- Access logging to `agent_logs` table (throttled per app to avoid spam)
- macOS, Linux, and Windows support
