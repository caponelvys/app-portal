// Single source of truth for the current agent version used across the portal UI.
// When releasing a new agent version:
//   1. Bump AGENT_VERSION here and in agent/agent.py (AGENT_VERSION constant)
//   2. Add an entry to agent/CHANGELOG.md
//   3. Copy agent/* → public/downloads/ (agent.py, install_*, update_*)

export const AGENT_VERSION = '1.5.0'

export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

export const AGENT_CHANGELOG: ChangelogEntry[] = [
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
