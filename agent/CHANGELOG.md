# App Controller Agent — Changelog

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
