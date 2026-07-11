// Single source of truth for the current agent version used across the portal UI.
// When releasing a new agent version:
//   1. Bump AGENT_VERSION here and in agent/agent.py (AGENT_VERSION constant)
//   2. Add an entry to agent/CHANGELOG.md
//   3. Copy agent/* → public/downloads/ (agent.py, install_*, update_*)

export const AGENT_VERSION = '1.8.0'

// Current companion (tray/menu-bar app) version. The agent polls this alongside
// the agent version and re-installs the companion when it changes, so companion
// updates ship without a manual reinstall. Bump on any companion change (icon,
// code); existing installs (no marker) reinstall once to converge.
export const COMPANION_VERSION = '0.2.2'

// True if a reported agent version is older than `latest` (null = never
// reported → treated as behind). Numeric per-segment compare.
export function isVersionBehind(version: string | null | undefined, latest: string = AGENT_VERSION): boolean {
  if (!version) return true
  const a = version.split('.').map(n => parseInt(n, 10) || 0)
  const b = latest.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0
    if (x < y) return true
    if (x > y) return false
  }
  return false
}

export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

export const AGENT_CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.8.0',
    date: '2026-07-11',
    changes: [
      'Per-device authentication. The agent no longer uses the shared public anon key to talk to Supabase directly — that key let anyone write any device’s rows across tenants. On enrollment the portal now mints a per-device bearer token (stored hashed server-side, 0600 on the device); the agent sends it to a single authenticated /api/agent/sync endpoint each cycle, which carries heartbeat/logs/events/inventory/command-results up and the resolved policy/enforcement state down. The server derives the device from the token, so an agent can only ever read/write its own rows. Requires migration 0036. Existing devices are backfilled a token automatically on their next enroll.',
    ],
  },
  {
    version: '1.7.25',
    date: '2026-07-08',
    changes: [
      'Fix: inventory executable-hash cache now keyed on (path, mtime) instead of (path, version), so an app updated in place with an unchanged version string is re-hashed rather than reporting a stale sha256 forever (which could make hash-block rules silently miss).',
    ],
  },
  {
    version: '1.7.24',
    date: '2026-07-08',
    changes: [
      'Elevation control (enforcement extension): an elevate_app command launches an elevation-eligible app (marked allow_elevation) with elevated privileges in the user session, without granting local admin. macOS runs the app as root via launchctl asuser; Windows uses a highest-run-level scheduled task (best-effort, to be validated on the Windows VM). Requires migration 0032.',
    ],
  },
  {
    version: '1.7.23',
    date: '2026-07-08',
    changes: [
      'Removable-storage (USB) control (enforcement extension): a scope can block removable storage — the agent ejects unauthorized external USB volumes on macOS, disables/restores the USBSTOR service on Windows, and unmounts removable media on Linux. Effective policy resolves device > ring > location > org > allow. Requires migration 0031.',
    ],
  },
  {
    version: '1.7.22',
    date: '2026-07-08',
    changes: [
      'Ring-scoped policies (M3 CP2): the agent reads its rollout ring and factors ring-targeted policies into resolution (device > ring > location > org > global), so a policy staged on a ring applies to its devices regardless of location — enabling test → pilot → prod rollout. Requires migration 0028.',
    ],
  },
  {
    version: '1.7.21',
    date: '2026-07-08',
    changes: [
      'Per-build hash blocking: hash BLOCK policy rules now enforce per build — the agent hashes running app binaries (cached, system paths skipped) and kills only processes matching a pinned sha256, so a bad build is closed while newer builds keep running. No cost when no hash rules exist; learn mode observes instead of killing. Requires migration 0027.',
    ],
  },
  {
    version: '1.7.20',
    date: '2026-07-08',
    changes: [
      'Executable hashing (Discovery M2 CP4): inventory reports the sha256 of each app’s main executable, cached per (path, version) so only new or updated apps re-hash. This is the identity hash-based policy rules pin against — e.g. block one specific bad build while newer builds keep running.',
    ],
  },
  {
    version: '1.7.19',
    date: '2026-07-08',
    changes: [
      'Inventory now captures each app’s executable/process name (macOS CFBundleExecutable, Windows best-effort from DisplayIcon) so the portal can turn observed software into an enforceable policy — "block this" on an unmanaged app creates a catalog entry the agent enforces by name. Requires migration 0024.',
    ],
  },
  {
    version: '1.7.18',
    date: '2026-07-08',
    changes: [
      'Learning mode (Discovery M2): a device, location, or org can be set to "learn" instead of "enforce". In learn mode the agent observes but never kills — it records a would_block observation when a blocked app is running, so admins can see what enforcement would do before committing. Effective mode resolves device > location > org > enforce, defaulting to enforce on any lookup error. Requires migration 0023.',
    ],
  },
  {
    version: '1.7.17',
    date: '2026-07-08',
    changes: [
      'Installed-software inventory (Discovery M1): the agent scans installed apps — name, version, publisher, install path — and reports them to the portal (device_software table). macOS app bundles, Windows uninstall registry (machine-wide + per-user hives), Linux flatpak/snap. Hourly + on-change with stale-row pruning; stamps devices.last_inventory_at. Inventory failures never disrupt enforcement. Requires migration 0020.',
    ],
  },
  {
    version: '1.7.16',
    date: '2026-07-06',
    changes: [
      'macOS companion updates now refresh the app icon in LaunchServices (lsregister -f) so notifications show the current icon instead of a cached old one. Companion 0.2.2 also switches the macOS app/notification icon to the transparent diamond (no dark tile), matching the tray.',
    ],
  },
  {
    version: '1.7.15',
    date: '2026-07-06',
    changes: [
      'Fix macOS companion auto-update (from 1.7.14): the agent is a root session-0 daemon, and launchctl bootstrap gui/<uid> silently no-ops from there, so the newly installed companion never launched. It now loads via launchctl asuser and verifies the load before recording the version, so a failed load retries instead of sticking.',
    ],
  },
  {
    version: '1.7.14',
    date: '2026-07-06',
    changes: [
      'The agent now auto-updates the user-session companion (tray/menu-bar app). It watches the portal’s companion version and, when it changes, re-installs the companion for the logged-in user — Windows via a one-shot per-user task, macOS via the release app + LaunchAgent. Records the installed version so it’s a no-op once current. The companion has no self-updater, so this delivers its updates; bumping the companion version rolls it to every online agent within ~5 min.',
    ],
  },
  {
    version: '1.7.13',
    date: '2026-07-06',
    changes: [
      'Uninstall now fully removes the agent’s files. On macOS/Linux the data dir is deleted before the service is stopped (stopping the service kills the agent mid-cleanup, which used to leave /usr/local/ravyn behind). On Windows the running .exe locks its own dir, so a detached command removes C:\\Ravyn after the agent exits. Self-remove of the portal device record is retried and no longer follows redirects, so a device can’t linger in the portal after uninstall.',
    ],
  },
  {
    version: '1.7.12',
    date: '2026-07-06',
    changes: [
      'On self-uninstall the agent now also removes the user-session Ravyn Companion (menu-bar/tray app + its login autostart), so a portal-issued uninstall leaves nothing behind. macOS unloads the LaunchAgent and deletes the app; Windows runs a one-shot per-user task to stop the app, clear its Run key, and delete its install dir. No effect on devices without the companion.',
    ],
  },
  {
    version: '1.7.11',
    date: '2026-07-05',
    changes: [
      'Windows: grant the Users group modify rights on the companion notification spool (via icacls) so the user-session Ravyn Companion can post its heartbeat and consume notifications. No effect on devices without the companion.',
    ],
  },
  {
    version: '1.7.10',
    date: '2026-07-05',
    changes: [
      'When the Ravyn Companion (user-session app) is running, notifications are routed to it via a spool directory so they show with the Ravyn logo, instead of the plain osascript/msg banner. Falls back to the direct method when the companion isn’t present, so nothing changes on devices without it.',
    ],
  },
  {
    version: '1.7.9',
    date: '2026-07-05',
    changes: [
      'Report a stable, user-recognizable device name. On macOS the agent now uses the ComputerName (from System Settings) instead of socket.gethostname(), which can return a transient DHCP/mDNS name (sometimes a UUID). Windows uses COMPUTERNAME; Linux is unchanged.',
    ],
  },
  {
    version: '1.7.8',
    date: '2026-07-05',
    changes: [
      'Rebrand: the agent is now "Ravyn Agent". Service/task, launch daemon, Windows scheduled task + executable (RavynAgent.exe), data directory, and logs are renamed to Ravyn. Existing devices keep their identity via a one-time migration, but must be reinstalled to pick up the new service names.',
    ],
  },
  {
    version: '1.7.7',
    date: '2026-07-05',
    changes: [
      'Rebrand: on-device notifications (app blocked / installed / uninstalled) are now titled "Ravyn" instead of "App Controller".',
    ],
  },
  {
    version: '1.7.6',
    date: '2026-07-05',
    changes: [
      'Windows per-user app installs (Discord/Slack/Teams etc.) now kill the running app and its Squirrel updater before installing. These installers replace the app directory wholesale, so a running process locked the files and the install failed (Squirrel exited -1 behind a blocking dialog). Fixes Discord installs that failed when it was already running.',
    ],
  },
  {
    version: '1.7.5',
    date: '2026-07-04',
    changes: [
      'On self-uninstall the agent now removes its own device record from the portal (calls /api/devices/<id>/self-remove) so the device disappears from the UI automatically instead of lingering as a stale entry.',
    ],
  },
  {
    version: '1.7.4',
    date: '2026-07-04',
    changes: [
      'Verification build to confirm the Windows .exe self-update end-to-end with the new self-restarting watchdog task (installer fix). No functional change.',
    ],
  },
  {
    version: '1.7.3',
    date: '2026-07-04',
    changes: [
      'Verification build to exercise the Windows .exe self-update end-to-end (no functional change).',
    ],
  },
  {
    version: '1.7.2',
    date: '2026-07-04',
    changes: [
      'Fix Windows .exe self-update restart. Spawning a replacement process didn’t survive (Task Scheduler kills it with the parent’s job object), so the agent went silent after swapping the exe. The scheduled task is now created with restart-on-failure and the agent exits non-zero to trigger it — Task Scheduler relaunches the swapped exe. Requires reinstalling the Windows agent to pick up the new task settings.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-07-04',
    changes: [
      'Windows remote install now supports .exe installers (Discord/Slack/etc.), not just .msi. Since .exe installers have no common silent flag, set windows_install_args per app (default /S). Per-user installers run in the logged-in user’s session so they land in the right profile; .msi still installs machine-wide.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-07-04',
    changes: [
      'Windows agent can now ship as a standalone .exe (PyInstaller, built in CI) so no Python install is needed on the machine. The agent detects when it runs frozen and self-updates by swapping the .exe from the GitHub release instead of pulling agent.py. macOS/Linux are unchanged.',
    ],
  },
  {
    version: '1.6.3',
    date: '2026-07-04',
    changes: [
      'macOS install detects the installer by content instead of URL/extension (so redirect links work), adds .zip app bundles (unpacked with ditto), and installs any mountable disk image via hdiutil — covering far more apps. Installer URLs are now auto-filled for ~25 recognized apps.',
    ],
  },
  {
    version: '1.6.2',
    date: '2026-07-04',
    changes: [
      'macOS remote install now supports .dmg (drag-to-Applications apps like Notion) in addition to .pkg: the agent mounts the image, copies the .app into /Applications, and unmounts. Checksum verification still applies.',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-07-03',
    changes: [
      'Remote install now covers Windows .msi (msiexec, machine-wide) in addition to macOS .pkg, and verifies an optional SHA-256 checksum on the downloaded installer before running it — a configured checksum that doesn’t match is a hard failure.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-07-03',
    changes: [
      'Remote app install (macOS). Admins can push an install from the portal: the agent downloads the app’s configured .pkg installer URL, verifies it’s a real package, installs it silently (installer -pkg), reports the result, and notifies the user. Set mac_install_url on the app. Windows/Linux install coming later.',
    ],
  },
  {
    version: '1.5.5',
    date: '2026-07-03',
    changes: [
      'Windows remote uninstall now also handles per-user apps (Discord/Slack/Teams). When an app isn’t a machine-wide install, the agent runs the uninstall in the logged-in user’s session via a one-shot scheduled task (interactive token), reading its result back. Machine-wide installs still go through the registry.',
    ],
  },
  {
    version: '1.5.4',
    date: '2026-07-03',
    changes: [
      'Windows remote uninstall now works for machine-wide apps: since winget is not usable from the SYSTEM service, the agent runs the app’s silent uninstall string from the HKLM registry. Per-user installs (Discord/Slack/Teams) still need a windows_uninstall override or a machine-wide install.',
    ],
  },
  {
    version: '1.5.3',
    date: '2026-07-03',
    changes: [
      'Executes remote app-uninstall commands queued from the portal: kills the app, removes it (macOS deletes the /Applications bundle; Windows via winget; Linux via the package manager), reports success/failure back, and notifies the user. Uses optional per-app catalog overrides when set, otherwise best-effort heuristics.',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-07-03',
    changes: [
      'Shows the user a native notification banner when a blocked app is closed (e.g. "Discord is blocked by your administrator and has been closed"), so they understand why it disappeared — throttled per app. macOS/Linux show a banner; Windows shows a message box.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-07-03',
    changes: [
      'Transient network blips (a single failed poll that recovers next cycle) are no longer logged as errors — only a sustained outage (3+ consecutive failed checks) is surfaced, so the Agent Monitor stops flagging normal connectivity hiccups',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-07-01',
    changes: [
      'Executes portal-issued commands (restart, update now, uninstall) polled from the device each cycle',
      'Uninstall removes the service and installed files and stops the agent',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-07-01',
    changes: [
      'Reports the logged-in OS username (device_user) on every heartbeat — shown on the device page',
    ],
  },
  {
    version: '1.3.1',
    date: '2026-06-30',
    changes: [
      'Verification build to exercise the auto-update path end-to-end (no functional change)',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-30',
    changes: [
      'Auto-update: the agent checks for the latest published version every 5 min and updates itself — no manual per-device download needed',
      'Self-update validates the download (reject HTML, compile-check, version-match) and backs up before swapping, then restarts into the new version',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-06-30',
    changes: [
      'Fixed enrollment: agent posted to the wrong URL (/devices/api/enroll), so token enrollment silently failed with a 405. Now posts to /api/enroll',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-30',
    changes: [
      'Reports structured activity events (started, enrolled, paired, errors) to the portal — shown in the per-device Activity log',
      'Repeated errors are throttled so the activity log stays readable',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-06-30',
    changes: [
      'Installers/updaters validate the downloaded agent (rejects HTML, compile-checks) before replacing it — a bad download can no longer brick the agent',
      'Updates keep a backup (agent.py.bak) and roll back if the new agent fails to start',
      'Added dedicated update scripts (update_mac.sh / update_linux.sh / update_win.bat)',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-29',
    changes: [
      'Reports agent version on every heartbeat — visible in All Devices table',
      'Reports local IP address on every heartbeat',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-01',
    changes: [
      'Initial release',
      'Heartbeat every 5 seconds',
      'App enforcement with org/location/device policy overrides',
      'Enrollment via token for auto location assignment',
      'Device pairing code for user self-enrollment',
      'Access logging (throttled per app)',
      'macOS, Linux, and Windows support',
    ],
  },
]
