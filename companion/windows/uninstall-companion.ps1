# Uninstall the Ravyn Companion (Windows). Reverses install-companion.ps1: stops
# the running app, removes the per-user autostart Run key, and deletes the install
# dir under %LOCALAPPDATA%\Ravyn. No admin needed (all per-user).
#   Run:  iwr https://appcontroller.vercel.app/downloads/uninstall-companion.ps1 | iex
$ErrorActionPreference = "SilentlyContinue"

$dest = Join-Path $env:LOCALAPPDATA 'Ravyn'

Write-Host "[uninstall] Stopping the companion..."
Get-Process RavynCompanion -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "[uninstall] Removing autostart (per-user Run key)..."
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' `
  -Name 'RavynCompanion' -ErrorAction SilentlyContinue

Write-Host "[uninstall] Removing install dir -> $dest"
Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue

Write-Host "[uninstall] Done -> Ravyn Companion removed. (The Ravyn Agent, if installed, is untouched.)"
