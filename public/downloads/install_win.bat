@echo off
:: App Controller Agent — Windows Installer
:: Run as Administrator
:: Usage: install_win.bat [--token <enrollment_token>]

setlocal enabledelayedexpansion

set "AGENT_DIR=C:\AppController"
set "BASE_URL=https://appcontroller.vercel.app/downloads"
set "TOKEN="

:: Parse --token argument
:parse_args
if "%~1"=="" goto done_args
if /i "%~1"=="--token" (
  set "TOKEN=%~2"
  shift
)
shift
goto parse_args
:done_args

echo [install] Creating agent directory...
mkdir "%AGENT_DIR%" 2>nul

echo [install] Downloading agent files...
curl -fsSL "%BASE_URL%/agent.py" -o "%AGENT_DIR%\agent.py"
curl -fsSL "%BASE_URL%/requirements.txt" -o "%AGENT_DIR%\requirements.txt"

:: Save enrollment token if provided
if not "%TOKEN%"=="" (
  echo %TOKEN% > "%AGENT_DIR%\.enrollment_token"
  echo [install] Enrollment token saved.
)

echo [install] Installing Python dependencies...
pip install -r "%AGENT_DIR%\requirements.txt" --quiet

echo [install] Registering as a Windows scheduled task...
schtasks /create /tn "AppControllerAgent" /tr "python \"%AGENT_DIR%\agent.py\"" /sc onlogon /ru SYSTEM /rl HIGHEST /f

echo [install] Starting agent...
schtasks /run /tn "AppControllerAgent"

echo [install] Done! Agent is running.
pause
