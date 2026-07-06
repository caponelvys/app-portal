@echo off
:: Ravyn Agent - Windows Installer (standalone .exe, no Python needed)
:: Usage: install_win.bat [--token <enrollment_token>]

:: --- Elevation: this installer MUST run as Administrator (it registers a task
:: that runs as SYSTEM). A non-elevated shell gets "Access is denied" silently.
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo [install] Administrator rights are required. Relaunching with elevation...
  if "%~1"=="" (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  ) else (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
  )
  exit /b
)

setlocal enabledelayedexpansion
set "AGENT_DIR=C:\Ravyn"
set "EXE=%AGENT_DIR%\RavynAgent.exe"
set "EXE_URL=https://github.com/caponelvys/app-portal/releases/download/agent-latest/RavynAgent.exe"
set "TOKEN="

:parse_args
if "%~1"=="" goto done_args
if /i "%~1"=="--token" ( set "TOKEN=%~2" & shift )
shift
goto parse_args
:done_args

echo [install] Creating agent directory...
mkdir "%AGENT_DIR%" 2>nul

echo [install] Downloading agent...
curl -fsSL "%EXE_URL%" -o "%EXE%"
if not exist "%EXE%" (
  echo [install] ERROR: could not download the agent. Check the internet connection and try again.
  pause
  exit /b 1
)

if not "%TOKEN%"=="" (
  echo %TOKEN%> "%AGENT_DIR%\.enrollment_token"
  echo [install] Enrollment token saved.
)

:: --- Register a self-restarting watchdog task (verified on Win11 build 26100).
:: A minutely repetition trigger with MultipleInstances=IgnoreNew: while the agent
:: runs the fires are no-ops; when it exits (crash or self-update) the next fire
:: (<=60s) relaunches it. Independent of exit code. ExecutionTimeLimit 0 removes
:: the default 3-day kill. The PowerShell verifies the task exists and returns a
:: nonzero code on any failure so we never claim success without a task.
:: Remove any prior "App Controller" task (pre-rebrand) so we don't run two
:: agents. C:\AppController is left in place so the agent can migrate its identity.
schtasks /end /tn "AppControllerAgent" >nul 2>nul
schtasks /delete /tn "AppControllerAgent" /f >nul 2>nul

echo [install] Registering scheduled task (SYSTEM, self-restarting)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $a=New-ScheduledTaskAction -Execute 'C:\Ravyn\RavynAgent.exe' -WorkingDirectory 'C:\Ravyn'; $tStart=New-ScheduledTaskTrigger -AtStartup; $tRepeat=New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650); $p=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest; $s=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero); Register-ScheduledTask -TaskName 'RavynAgent' -Action $a -Trigger @($tStart,$tRepeat) -Principal $p -Settings $s -Force | Out-Null; if (-not (Get-ScheduledTask -TaskName 'RavynAgent' -ErrorAction SilentlyContinue)) { exit 2 }; Start-ScheduledTask -TaskName 'RavynAgent'; exit 0 } catch { Write-Host ('  ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo [install] ERROR: failed to register the scheduled task -- the agent will NOT run.
  echo [install] Make sure you approved the Administrator prompt, then run this again.
  pause
  exit /b 1
)

echo [install] Verifying the agent is running...
timeout /t 5 >nul
tasklist /fi "imagename eq RavynAgent.exe" | find /i "RavynAgent.exe" >nul
if errorlevel 1 (
  echo [install] Note: the task is registered but the agent process isn't visible yet -- it will start within a minute.
) else (
  echo [install] Agent is running.
)

:: --- Install the Ravyn Companion (user-session tray app). Best-effort: a
:: failure here must not fail the agent install. Downloads the prebuilt exe,
:: registers per-user autostart, and launches it. Runs in the installing user's
:: context (%LOCALAPPDATA% / HKCU Run key).
echo [install] Installing the Ravyn Companion (tray app)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { iwr 'https://appcontroller.vercel.app/downloads/install-companion.ps1' -UseBasicParsing | iex } catch { Write-Host ('[install] Companion install skipped: ' + $_.Exception.Message) }"

echo [install] Done! The agent is installed and self-restarting.
pause
