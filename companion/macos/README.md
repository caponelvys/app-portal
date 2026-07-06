# Ravyn Companion — macOS (local dev build)

A menu-bar app that runs in the user's session. It shows **branded notifications**
(so the Ravyn logo appears, which the SYSTEM agent can't do) and lets the user
**request access** to a blocked app. See `docs/ravyn-companion-plan.md` for the
full design.

This is the local-only dev build — **ad-hoc signed**, no Developer ID /
notarization (that's deferred until the paid Apple account is renewed). It runs
fine on your own Mac; it just isn't distributable to other Macs yet.

## Build & run

```bash
cd companion/macos
bash build.sh
open Ravyn.app
```

A **Ravyn diamond** appears in the menu bar. First run: macOS asks to allow
notifications — click **Allow**.

## Try it

- **Menu bar → Test notification** → you should see a banner titled **Ravyn**
  showing the **Ravyn logo** (the whole point). If the logo shows here, we've
  fixed the macOS notification branding.
- **Menu bar → Request access…** → picks up this device's `device_id` from
  `/usr/local/ravyn/.device_id`, lists the blocked apps you can request, and
  submits to `POST /api/device-request`. The request shows up in the portal's
  **Requests** queue for an admin.

## How it fits together

- Reads `device_id` from `/usr/local/ravyn/.device_id` (written by the agent).
- Talks to the portal at `GET/POST /api/device-request` (device-authenticated).
- Watches `/usr/local/ravyn/notify/*.json` — the **spool** the agent will write
  notification requests to (agent wiring is the next step; until then, the
  agent still uses its own `osascript` fallback).

## Known TODO (tracked in the plan)

- Agent: write notifications to the spool + drop the osascript fallback once the
  companion is present. (Spool dir permissions for root→user hand-off.)
- Autostart at login via a LaunchAgent (installer).
- Developer ID signing + notarization for distribution (deferred).
- Align the duration options with `lib/durations`.
