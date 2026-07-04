@echo off
:: App Controller Agent - Windows Installer (standalone .exe, no Python needed)
:: Usage: install_win.bat [--token <enrollment_token>]

:: Self-elevate to Administrator if we aren't already.
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo [install] Requesting administrator privileges...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
  exit /b
)

setlocal enabledelayedexpansion
set "AGENT_DIR=C:\AppController"
set "EXE_URL=https://github.com/caponelvys/app-portal/releases/download/agent-latest/AppControllerAgent.exe"
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
curl -fsSL "%EXE_URL%" -o "%AGENT_DIR%\AppControllerAgent.exe"
if not exist "%AGENT_DIR%\AppControllerAgent.exe" (
  echo [install] ERROR: could not download the agent. Check the internet connection and try again.
  pause
  exit /b 1
)

if not "%TOKEN%"=="" (
  echo %TOKEN%> "%AGENT_DIR%\.enrollment_token"
  echo [install] Enrollment token saved.
)

echo [install] Registering scheduled task (runs as SYSTEM at boot)...
schtasks /create /tn "AppControllerAgent" /tr "\"%AGENT_DIR%\AppControllerAgent.exe\"" /sc onstart /ru SYSTEM /rl HIGHEST /f

echo [install] Starting agent...
schtasks /run /tn "AppControllerAgent"

echo [install] Done! The agent is installed and running.
pause
