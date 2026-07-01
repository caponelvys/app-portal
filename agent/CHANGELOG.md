# App Controller Agent — Changelog

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
