# Windows install/update semantics (managed apps)

Empirically verified on a Win11 test VM. These are the non-obvious per-installer
behaviors behind remote app install/update. Keep this in sync with reality — if
you re-test and find something different, update this file.

## Silent-install flags are per-installer-framework, not universal

`apps.windows_install_args` is passed verbatim to the downloaded `.exe`. The
agent's auto-fill defaults live in `KNOWN_WINDOWS_INSTALLERS`
(`app/admin/edit/[id]/page.tsx`). The auto-fill only applies when you edit an app
in the portal — it does **not** retroactively rewrite already-saved `apps` rows.

| Installer framework | Silent flag | Notes |
|---|---|---|
| Squirrel.Windows (Discord, Slack, Teams) | `--silent` (or `-s`) | `/S` is ignored (shows UI + auto-launches) |
| NSIS / electron-builder (Notion) | `/S` | `-s` / `--silent` are ignored (shows UI + auto-launches) |
| Inno Setup | `/VERYSILENT` | |
| MSI | (machine-wide via msiexec) | handled separately; not an `.exe` |

Success exit code for `.exe` installers is **0** (agent also accepts `3010` =
"restart required"). Neither Discord nor Notion has a "non-zero on success" quirk.

### Discord (`DiscordSetup.exe`, Squirrel)
- URL: `https://discord.com/api/download?platform=win`
- args: `--silent` — installs to `%LocalAppData%\Discord\app-<ver>\Discord.exe`,
  adds an HKCU `...\CurrentVersion\Run` entry, and auto-launches after a normal
  install → **it is usually running when a reinstall happens.**

### Notion (`Notion Setup.exe`, NSIS)
- URL: `https://www.notion.so/desktop/windows/download`
- args: `/S` — per-user install to `%LocalAppData%\Programs\Notion\Notion.exe`.
- Uninstall string: `"%LocalAppData%\Programs\Notion\Uninstall Notion.exe" /currentuser /S`

## Root cause of the Discord "Installer exited" failures (fixed in v1.7.6)

**The app was running during install — not the flag.** Squirrel wipes the
existing install directory on every (re)install:

```
Program: Install path ...\Discord already exists, burning it to the ground
IEnableLogger: Failed to remove existing directory on full install, is the app still running???
System.IO.IOException: Access to the path '...\Discord' is denied.
→ Unhandled exception → exit -1
```

A running `Discord.exe` / `Update.exe` (Squirrel's per-user updater) holds a file
lock → IOException → **exit -1** plus a **modal error dialog**. In the unattended
agent that dialog blocks the installer's `-Wait` until dismissed.

**Fix (v1.7.6):** `_install_windows` kills the app's `process_name` and
`Update.exe` before running any per-user `.exe` installer, then waits 1s for
handles to release. Mirrors `uninstall_app`, which already kills first. Switching
the flag alone does **not** help — the kill is the real fix.

## Operational caveats
1. Per-user installers (`.exe`) must run in the **interactive user session**
   (active console, session 1), not session 0. The agent does this via a one-shot
   scheduled task with an interactive token (`schtasks ... /it`).
2. `--silent` ≠ "never shows UI": Squirrel still pops a blocking dialog on
   *failure*. Avoid failures (see the kill-first fix) rather than relying on silence.
3. Test method: `Start-Process <exe> -ArgumentList <args> -Wait -PassThru`, read
   `.ExitCode`. Uninstall between attempts (Discord:
   `%LocalAppData%\Discord\Update.exe --uninstall -s` + delete dir; Notion: the
   quiet uninstall string above).

## Related: Windows frozen (.exe) self-update restart (fixed in v1.7.2)

Separate but adjacent Windows quirk. When the agent ships as a PyInstaller `.exe`,
self-update swaps the `.exe` and must restart. Spawning a detached replacement did
**not** survive: Task Scheduler runs the agent in a **job object** that terminates
child processes when the parent exits, so the agent went silent after swapping.

**Fix (v1.7.2):** the scheduled task is created with **restart-on-failure**, and
the agent **exits non-zero** after swapping the exe so Task Scheduler relaunches
the (now-updated) exe. Requires reinstalling the Windows agent to pick up the new
task settings (`install_win.bat`).
