# Ravyn Companion — Windows (local dev build)

A system-tray app that runs in the user's session. It shows **branded
notifications** on behalf of the SYSTEM agent (which can't reach the user
session) and lets the user **request access** to a blocked app. See
`docs/ravyn-companion-plan.md` for the full design.

WinForms, **no external NuGet packages** — builds with just the .NET SDK.

## Prerequisites

- **.NET 8 SDK** on the machine: https://dotnet.microsoft.com/download/dotnet/8.0
  (the Windows VM is ARM64 — grab the Arm64 SDK). Check with `dotnet --version`.
- The **Ravyn Agent** installed (it creates/permissions `C:\Ravyn\notify` and
  writes `C:\Ravyn\.device_id`, which the companion reads). Agent ≥ v1.7.11.

## Build & run

```powershell
cd companion\windows
.\build.ps1
```

This publishes a self-contained single-file exe, installs it to
`%LOCALAPPDATA%\Ravyn\RavynCompanion.exe`, registers autostart (per-user Run
key), and launches it. No admin required.

Look for the **Ravyn icon in the system tray** (click the `^` to show hidden
icons — you can drag it onto the taskbar to keep it visible).

## Try it

- **Right-click the tray icon → Test notification** → a toast titled **Ravyn**.
- **Right-click → Request access…** → reads `C:\Ravyn\.device_id`, lists the
  blocked apps you can request, and submits to `POST /api/device-request`.

## How it fits together

- Reads `device_id` from `C:\Ravyn\.device_id` (written by the agent).
- Talks to the portal at `GET/POST /api/device-request` (device-authenticated).
- Watches `C:\Ravyn\notify\*.json` — the spool the agent writes notifications to
  (agent ≥ v1.7.11 grants the Users group write access to that dir). Posts a
  `.companion_alive` heartbeat there so the agent routes notifications to it.

## Known TODO (tracked in the plan)

- Proper WinRT toast with a registered AppUserModelID for guaranteed branding
  (this first cut uses `NotifyIcon.ShowBalloonTip`, which shows the tray icon).
- Code-signing to avoid SmartScreen (deferred).
- Fold the build/autostart into the agent's `install_win.bat` for fleet rollout.
