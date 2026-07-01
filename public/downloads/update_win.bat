@echo off
:: App Controller Agent — Windows Updater
:: Safely replaces agent.py with the latest version and restarts the task.
:: Run as Administrator

setlocal enabledelayedexpansion

set "AGENT_DIR=C:\AppController"
set "BASE_URL=https://appcontroller.vercel.app/downloads"

if not exist "%AGENT_DIR%\agent.py" (
  echo [update] Agent is not installed. Run the installer first.
  exit /b 1
)

echo [update] Downloading latest agent...
curl -fsSL "%BASE_URL%/agent.py" -o "%AGENT_DIR%\agent.py.new"

:: Validate before touching the running agent so a bad download can't brick it.
python -c "import py_compile; py_compile.compile(r'%AGENT_DIR%\agent.py.new', doraise=True)" 2>nul
if errorlevel 1 (
  echo [update] ERROR: download is invalid (not Python^). Current agent left untouched.
  del "%AGENT_DIR%\agent.py.new" 2>nul
  exit /b 1
)

echo [update] Backing up and installing new agent...
copy /y "%AGENT_DIR%\agent.py" "%AGENT_DIR%\agent.py.bak" >nul
move /y "%AGENT_DIR%\agent.py.new" "%AGENT_DIR%\agent.py" >nul

echo [update] Restarting agent...
schtasks /end /tn "AppControllerAgent" >nul 2>nul
schtasks /run /tn "AppControllerAgent"
if errorlevel 1 (
  echo [update] Restart failed — rolling back to previous agent.
  move /y "%AGENT_DIR%\agent.py.bak" "%AGENT_DIR%\agent.py" >nul
  schtasks /run /tn "AppControllerAgent"
  exit /b 1
)

echo [update] Done. Agent updated and restarted.
