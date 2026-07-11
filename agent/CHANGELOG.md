# Ravyn Agent — Changelog

## v1.8.0 — 2026-07-11
- **Per-device authentication (security).** The agent no longer talks to Supabase
  PostgREST directly with the shared, public anon key. That key shipped in the
  browser bundle and hardcoded here, and every agent table was gated only by
  `auth.role()='anon'` with no per-device binding — so anyone holding it could
  write (or wipe) any device's rows across tenants, and the resolver RPCs took an
  arbitrary `p_device_id` so anyone could read any device's policy posture.
- On enrollment the portal now mints a **per-device bearer token** (only its
  sha256 is stored, in `devices.token_hash`; the secret is written `0600` to
  `.device_token`). Every cycle the agent makes ONE authenticated call to
  `POST /api/agent/sync`, which carries heartbeat / enforcement logs / lifecycle
  events / inventory / command results **up** and the resolved enforcement mode,
  app policies, blocked-hash set, USB policy, grants, and pending commands
  **down**. The server derives the device from the token and scopes every
  read/write to it, so an agent can only ever touch its own rows. This also
  replaces ~8 direct round-trips per cycle with a single one.
- Existing devices are **backfilled** a token automatically on their next enroll;
  a device that loses its local token can be recovered with an admin token reset
  (`POST /api/devices/[id]/reset-token`) followed by re-enroll.
- Requires **migration 0036** (adds `devices.token_hash` + removes all anon access
  to the agent surface). `/api/agent/version` stays unauthenticated so an outdated
  field agent can still self-update to this build.

## v1.7.25 — 2026-07-08
- **Fix: inventory sha256 now re-hashes on in-place updates.** The executable
  hash cache was keyed on (path, version); an app updated in place while keeping
  the same version string would report a stale hash forever (and the on-change
  upload gate would never correct it, so hash-block rules could silently miss).
  Now keyed on (path, mtime), matching the enforcement-side hash cache.

## v1.7.24 — 2026-07-08
- **Elevation control** (enforcement extension): a new `elevate_app` device
  command launches an elevation-eligible app (apps.allow_elevation) with elevated
  privileges in the logged-in user's session, without granting local admin.
  macOS runs the app bundle's executable as root via `launchctl asuser` (the
  agent is root); Windows uses a one-shot highest-run-level scheduled task
  (best-effort, UNTESTED on real hardware — a standard user has no higher token,
  so true elevation for them needs a SYSTEM/admin principal; to be validated on
  the Windows VM). Requires migration 0032.

## v1.7.23 — 2026-07-08
- **Removable-storage (USB) control** (enforcement extension): a scope can block
  removable storage. The agent (root/SYSTEM) ejects unauthorized external USB
  volumes on macOS, disables the USBSTOR service on Windows (and restores it
  when the policy returns to 'allow'), and unmounts removable media on Linux.
  Effective policy resolves device > ring > location > org > allow via the
  `effective_removable_storage` RPC; defaults to 'allow' on any error. Requires
  migration 0031.

## v1.7.22 — 2026-07-08
- **Ring-scoped policies** (M3 CP2): the agent reads its `ring_id` and factors
  ring-targeted policies into resolution, precedence device > ring > location >
  org > global. A policy staged on a rollout ring applies to its devices
  regardless of location, enabling test → pilot → prod rollout. Requires
  migration 0028 (`ring` added to app_policies scope types).

## v1.7.21 — 2026-07-08
- **Per-build hash blocking**: hash BLOCK policy rules now enforce per build.
  The agent hashes running app binaries (system paths skipped, cached per
  path+mtime) and kills only processes whose sha256 matches a pinned build — so
  a bad build is closed while newer builds keep running. Skipped entirely when
  no hash rules exist, so there's no steady-state cost. Learn mode observes
  (would_block) instead of killing. Requires migration 0027
  (`blocked_hashes_for_device`).

## v1.7.20 — 2026-07-08
- **Executable hashing** (Discovery M2 CP4): inventory now reports the sha256 of
  each app's main executable (macOS `Contents/MacOS/<exe>`, Windows the
  `DisplayIcon` exe). Cached per (path, version) so only new/updated apps re-hash
  — a steady fleet pays ~nothing. This is the identity hash-based policy rules
  pin against (e.g. block one bad build while newer builds still run). No
  migration — the `sha256` column shipped unused in 0020.

## v1.7.19 — 2026-07-08
- **Inventory now captures the executable/process name** (Discovery M2 CP3):
  macOS from `CFBundleExecutable` (exactly what `ps` reports), Windows
  best-effort from the uninstall entry's `DisplayIcon` exe. This is the key
  that lets the portal turn observed software into an enforceable policy — a
  "block this" on an unmanaged app materializes a catalog entry the agent can
  act on by name. Requires migration 0024 (`device_software.process_name`).

## v1.7.18 — 2026-07-08
- **Learning mode** (Discovery M2): a device, location, or org can be set to
  `learn` instead of `enforce`. In learn mode the agent observes but never kills
  — when a blocked app is running it records a `would_block` observation (to
  agent_events, throttled per app) so an admin can see what enforcement would do
  before committing. Effective mode resolves device > location > org > enforce
  via the `effective_enforcement_mode` RPC, and defaults to `enforce` on any
  lookup error so enforcement is never silently disabled. Requires migration
  0023.

## v1.7.17 — 2026-07-08
- **Installed-software inventory** (Discovery M1): the agent now scans what's
  installed on the device — name, version, publisher, install path — and
  reports it to the portal. macOS: app bundles in /Applications +
  ~/Applications (Info.plist + codesign authority); Windows: HKLM 64/32-bit
  uninstall registry plus loaded user hives, so per-user installs
  (Discord-style) are seen from the SYSTEM service; Linux: flatpak + snap.
  Scans hourly and uploads only when the set changed, then prunes uninstalled
  rows, so `device_software` mirrors the box. Stamps
  `devices.last_inventory_at` each scan so the portal can tell fresh from
  stale. Inventory failures are contained (logged as `inventory_failed`) and
  never disrupt enforcement. Requires migration 0020.

## v1.7.16 — 2026-07-06
- macOS companion updates now run `lsregister -f` on the installed app so macOS
  refreshes its icon — notifications show the current icon instead of a cached
  old one after an in-place update. Paired with companion 0.2.2, whose macOS
  app/notification icon is now the transparent diamond (no dark tile), matching
  the menu-bar/tray icon.

## v1.7.15 — 2026-07-06
- Fix macOS companion auto-update (from v1.7.14): the agent runs as a root
  session-0 LaunchDaemon, and `launchctl bootstrap gui/<uid>` silently no-ops from
  there, so the freshly-installed companion never started (and the version marker
  was written anyway, suppressing retries). Now the load runs via
  `launchctl asuser <uid> launchctl bootstrap …` (the user-session trick notify
  already uses) and is verified with `launchctl print` before the marker is
  written — a failed load now retries next cycle instead of silently sticking.

## v1.7.14 — 2026-07-06
- The agent now keeps the **user-session companion** up to date automatically. It
  polls the portal's `companion_version` alongside its own version and, when that
  changes, re-runs the per-user companion installer for the logged-in user —
  Windows via a one-shot interactive scheduled task (`iwr install-companion.ps1`),
  macOS by installing the release `Ravyn.app` + LaunchAgent. The installed version
  is recorded in `<data>/.companion_version`, so it's a no-op once current (no
  reinstall loop). The companion has no self-updater; this delivers its updates.
  Bumping `COMPANION_VERSION` in the portal rolls the companion to every online
  agent within ~5 min.

## v1.7.13 — 2026-07-06
- Uninstall now fully removes the agent's own footprint. On **macOS/Linux** the
  data dir (`/usr/local/ravyn`) is deleted *before* the service is stopped —
  `launchctl bootout` / `systemctl --now` kills this very process, so unregistering
  first meant `rmtree` never finished and the data dir (incl. `.device_id` + the
  notify spool) leaked. On **Windows** the running `RavynAgent.exe` locks `C:\Ravyn`,
  so a detached `cmd` now waits for the agent to exit and removes the dir(s).
- Self-remove of the portal device record is retried up to 3× and no longer follows
  redirects, so a transient failure (or an auth redirect) can't leave a ghost device
  in the portal. (Pairs with the portal middleware fix that stopped bouncing
  `/api/devices/<id>/self-remove` to `/login`.)

## v1.7.12 — 2026-07-06
- Self-uninstall now tears down the user-session Ravyn Companion too, so a
  portal-issued uninstall leaves nothing behind. macOS unloads the
  `app.ravyn.companion` LaunchAgent from the console user's session and deletes
  `Ravyn.app` (both the fleet `/Applications` and standalone `~/Applications`
  copies) + the plist. Windows runs a one-shot interactive scheduled task in the
  user's session to stop `RavynCompanion`, remove its `HKCU\...\Run` autostart
  entry, and delete `%LOCALAPPDATA%\Ravyn`. No effect on devices without the
  companion.
- Added standalone `uninstall-companion.sh` (macOS) / `uninstall-companion.ps1`
  (Windows) to reverse the manual companion install.

## v1.7.11 — 2026-07-05
- Windows: grant the Users group modify rights on the companion notification
  spool (`C:\Ravyn\notify`) via `icacls`, so the user-session Ravyn Companion can
  post its heartbeat and delete consumed notifications. No effect without the
  companion.

## v1.7.10 — 2026-07-05
- When the Ravyn Companion (user-session app) is running, notifications are routed
  to it through a world-writable spool dir (`<data>/notify/`) so they render with
  the Ravyn logo instead of the plain osascript/msg banner. The companion posts a
  heartbeat; if it's stale/absent the agent falls back to the direct method, so
  devices without the companion are unaffected.

## v1.7.9 — 2026-07-05
- Report a stable, user-recognizable device name. On macOS the agent now uses
  the ComputerName (from System Settings) instead of `socket.gethostname()`,
  which can return a transient DHCP/mDNS name (sometimes a UUID). Windows uses
  `COMPUTERNAME`; Linux is unchanged.

## v1.7.8 — 2026-07-05
- Rebrand: the agent is now "Ravyn Agent". The systemd service (`ravyn-agent`),
  launchd daemon (`com.ravyn.agent`), Windows scheduled task + executable
  (`RavynAgent.exe`), data directory (`/usr/local/ravyn`, `C:\Ravyn`), and logs
  are renamed to Ravyn. Existing devices keep their identity via a one-time state
  migration; installers remove the old service so two agents never run at once.
  Devices must be **reinstalled** to adopt the new service names.

## v1.7.7 — 2026-07-05
- Rebrand: on-device notifications (app blocked / installed / uninstalled) are
  now titled "Ravyn" instead of "App Controller".

## v1.7.6 — 2026-07-05
- Windows per-user app installs (Discord/Slack/Teams etc.) now kill the running
  app and its Squirrel updater (Update.exe) before installing. These installers
  replace the app's install directory wholesale, so a running process locked the
  files and the install failed — Squirrel exited -1 behind a blocking dialog that
  hung the unattended install task. Mirrors uninstall, which already kills first.
  Fixes Discord installs that failed whenever it was already running (the common
  case, since Discord auto-launches and registers a Run entry after install).

## v1.7.5 — 2026-07-04
- On self-uninstall the agent deletes its own device record from the portal
  (POST /api/devices/<id>/self-remove) so the device auto-disappears from the UI
  instead of lingering as a stale entry. Best-effort; audit history is kept.

## v1.7.4 — 2026-07-04
- Verification build to confirm the Windows .exe self-update end-to-end with the
  new self-restarting watchdog task (install_win.bat fix). No functional change.

## v1.7.3 — 2026-07-04
- Verification build to exercise the Windows .exe self-update end-to-end (no
  functional change).

## v1.7.2 — 2026-07-04
- Fix Windows frozen (.exe) self-update restart. The previous approach (spawn a
  detached replacement, then exit) didn't survive: Task Scheduler runs the agent
  in a job object that terminates child processes when the parent exits, so the
  agent went silent after swapping the exe (seen on the Win11 VM: "update_applied"
  logged, then no heartbeats). Now the scheduled task is created with
  restart-on-failure (Register-ScheduledTask, RestartCount/RestartInterval, no
  execution time limit), and on update the agent exits non-zero so Task Scheduler
  relaunches it into the swapped exe. Reinstall the Windows agent to pick up the
  new task settings.

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
