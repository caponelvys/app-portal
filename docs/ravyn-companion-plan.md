# Ravyn Companion — Design Plan

Status: **Draft for review** · Owner: TBD · Last updated: 2026-07-05

## 1. Why

The Ravyn Agent runs as **SYSTEM (Windows) / root (macOS, Linux)** in session 0.
That's correct for enforcement, but it means the agent *cannot* do anything
that must live in the logged-in user's session:

- **macOS notifications** show a generic Script Editor icon (osascript can't set
  a custom icon), not the Ravyn logo.
- **Windows notifications** don't appear at all — the agent uses `msg.exe`, which
  is absent on Home editions and unreliable to target from session 0.
- There's **no user-facing UI** for an employee to request access to a blocked app
  (today they'd use the web portal, if they even have an account).

All three problems have the **same fix**: a small, per-user **companion process**
that runs in the user's session. This one app delivers:

1. A **system-tray / menu-bar** presence with a **"Request app access"** flow.
2. **Branded notifications** — Ravyn logo on macOS, real toasts (with icon) on
   Windows, `notify-send -i` on Linux.

## 2. Goals / Non-goals

**Goals (v1)**
- Tray icon on Win/macOS/Linux.
- "Request access" — pick a blocked app + reason + duration, submit to the portal.
- Branded notifications, driven by the agent (app blocked / installed / uninstalled).
- Zero-config for the end user (starts at login, no sign-in if avoidable).

**Non-goals (v1)**
- No admin/policy features (that stays in the web portal).
- No self-update at first (add later; agent already has a model to copy).
- No telemetry beyond what the agent already reports.

## 3. Architecture

```
┌─────────────────────────── Device ───────────────────────────┐
│                                                               │
│  Ravyn Agent (SYSTEM/root, session 0)                         │
│    • enforcement, install/uninstall, heartbeats               │
│    • writes notification requests → spool dir                 │
│                    │                                          │
│                    ▼  (file spool: {title, message}.json)    │
│  Ravyn Companion (user session, per-login)                    │
│    • watches spool → renders branded notification             │
│    • tray menu → "Request access" window                      │
│    • POSTs requests → portal                                  │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS (anon key + device_id)
                            ▼
                     Ravyn Portal API
```

Two processes, one device. They talk through a **file spool** (simple, robust
across the SYSTEM↔user session boundary) rather than sockets/pipes.

**Chosen stack: native per-OS** (see §10) — SwiftUI menu-bar app on macOS, C#/.NET
tray app on Windows, for best-in-class UX and first-class notification APIs
(`UNUserNotificationCenter`, WinRT toasts). Trade-off: two codebases and two build
toolchains in CI. (Python + `pystray` was the single-codebase alternative.)

## 4. Identity & auth — **KEY DECISION**

The companion must attach each request to a portal **user** (`app_requests.user_id`).

- **Option A — device-owner based (recommended).** The companion reads the
  `device_id` (written by the agent to a user-readable file), and calls a new
  endpoint `POST /api/device-request` with `{device_id, app_id, reason, duration}`.
  The portal resolves `device → owner (user_id)` and creates the request. Uses the
  anon key exactly like the agent — **no user sign-in.** Requires the device to
  have an owner set (we already support owners + pairing).
- **Option B — user sign-in.** The companion signs the user into Supabase once and
  stores a session; requests are made as that user. Explicit identity, works even
  with no device owner, but adds a login step.

**Recommendation: A**, with a graceful prompt ("ask your admin to assign this
device to you") if the device has no owner. `device_id` is not a secret (the anon
key is already embedded in the agent), and requests are non-privileged — an admin
approves every one — so the forgery risk is low. Rate-limit the endpoint.

## 5. Request-access flow

1. User opens the tray menu → **Request access…**
2. Companion fetches the requestable (blocked) apps for this device's org.
3. User picks an app, types a reason, selects a duration.
4. Companion `POST /api/device-request`.
5. Portal creates an `app_requests` row (status `pending`) for the device owner —
   it shows up in the existing admin **Requests** queue.
6. Companion confirms with a notification.

This mirrors the existing web `RequestAccess` component + `app_requests` table +
`/api/app-requests`; the only new server piece is the device-authenticated
endpoint(s).

## 6. Notifications (agent → companion)

- The agent **stops** calling `osascript` / `msg.exe` directly. Instead it writes a
  JSON file to a spool dir (`C:\ProgramData\Ravyn\notify\` /
  `/usr/local/ravyn/notify/`) — `{ "title": "Ravyn", "message": "..." }`.
- The companion watches the spool, renders the notification, deletes the file.
- Per-OS rendering:
  - **Windows** — toast via `windows-toasts` with a registered **AUMID** + Ravyn
    icon (installer creates a Start-menu shortcut carrying the AUMID). Shows the
    logo; appears in the user session (the whole point).
  - **macOS** — the companion is a **signed `.app`**; post via
    `UNUserNotificationCenter` (pyobjc). The notification shows the app's icon =
    the Ravyn mark. One-time "allow notifications" prompt.
  - **Linux** — `notify-send -i /path/ravyn.png`.
- **Fallback:** if the companion isn't installed/running, the agent falls back to
  today's `osascript` / `msg.exe` behavior — so nothing regresses during rollout.

## 7. Build · sign · distribute

- **Windows** — add a 2nd PyInstaller target in CI → `RavynCompanion.exe`. Optional
  code-signing (helps SmartScreen; can start unsigned). The agent installer also
  drops the companion and registers a **logon scheduled task** (runs in the user
  session at login) + the AUMID shortcut.
- **macOS** — needs a **new GitHub Actions `macos` runner** job: PyInstaller `.app`
  → `codesign` (Developer ID) → `notarytool` → staple. Requires the Developer ID
  cert + an App Store Connect API key as CI secrets (or build/sign locally on your
  Mac to start). Installed by the mac installer; autostart via a **LaunchAgent**.
- **Linux** — PyInstaller binary; autostart via `~/.config/autostart/ravyn.desktop`.

## 8. Security

- `device-request` endpoint: anon key + `device_id`, like the agent. Non-privileged
  (admin approves). Rate-limit; validate the app belongs to the device's org.
- `device_id` exposed to the user session is fine (not a secret).
- macOS: one-time notification-permission prompt; Gatekeeper/notarization handled
  by signing.
- Windows: unsigned `.exe` → first-run SmartScreen warning until we sign.

## 9. Phasing (each phase testable on the Mac + Windows VM)

- **Phase 0 — this doc + decisions** (identity model, stack, phasing, signing).
- **Phase 1 — Notifications only.** Companion with *no* tray UI yet: it just
  watches the spool and renders branded notifications. Agent writes the spool +
  keeps the fallback. **Smallest slice, immediately fixes the Mac logo + Windows
  toasts.**
- **Phase 2 — Tray + request access.** Tray icon, request window, and the
  `/api/device-request` endpoint(s).
- **Phase 3 — Polish.** "My requests" status view, self-update, full CI signing +
  notarization, Linux autostart.

## 10. Decisions (locked 2026-07-05)

1. **Identity** — **device-owner, no sign-in** (Option A). New `/api/device-request`
   endpoint maps `device_id → owner`.
2. **Stack** — **native per-OS**: Swift/SwiftUI menu-bar app (macOS), C#/.NET (WinUI 3
   or WPF) tray app (Windows). Two codebases, best-in-class UX.
3. **Scope** — build **tray + request-access + notifications together** as v1 (not
   notifications-first).
4. **macOS signing** — **CI signing from the start**: a `macos` GitHub Actions job
   that builds, `codesign`s (Developer ID), and `notarytool`-notarizes.

## 11. Build order & status

- [x] **Portal backend** — `POST/GET /api/device-request` (device-authenticated,
      maps device → owner, lists requestable apps). *Done + deployed + tested.*
- [ ] **macOS app** — SwiftUI menu-bar app: tray menu, request window,
      `UNUserNotificationCenter`, spool watcher, `/api/device-request` client.
- [ ] **Windows app** — C#/.NET tray app: NotifyIcon, request window, toast via
      AUMID + Ravyn icon, spool watcher, API client.
- [ ] **Agent** — write notification requests to the spool; keep osascript/msg
      fallback when the companion isn't present.
- [ ] **CI** — macOS job (xcodebuild → codesign → notarytool → staple) + Windows
      job (dotnet publish → sign). Installers place the companion + autostart
      (LaunchAgent / logon task) and register the Windows AUMID shortcut.

## 12. What's needed from you (unblocks native + CI)

- **macOS "Developer ID Application" certificate** (run `security find-identity -v
  -p codesigning`; if absent, create in Xcode → Settings → Accounts → Manage
  Certificates → + → Developer ID Application — needs the paid program + Account
  Holder/Admin role).
- **App Store Connect API key** (Issuer ID, Key ID, `.p8`) for `notarytool`, stored
  as GitHub Actions secrets — plus the Developer ID cert + its password exported as
  a `.p12` secret.
- *(Optional, Windows)* a code-signing certificate to avoid SmartScreen; we can
  ship unsigned to start.
