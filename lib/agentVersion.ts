// Single source of truth for the current agent version used across the portal UI.
// When releasing a new agent version:
//   1. Bump AGENT_VERSION here and in agent/agent.py (AGENT_VERSION constant)
//   2. Add an entry to agent/CHANGELOG.md
//   3. Copy agent/agent.py → public/downloads/agent.py

export const AGENT_VERSION = '1.1.0'

export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

export const AGENT_CHANGELOG: ChangelogEntry[] = [
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
