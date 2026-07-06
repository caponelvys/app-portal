# Download + install the Ravyn Companion (Windows) — no source or SDK needed.
# Fetches the prebuilt exe for this machine's arch, installs it to
# %LOCALAPPDATA%\Ravyn, registers autostart, and launches it. No admin needed.
#   Run:  iwr https://appcontroller.vercel.app/downloads/install-companion.ps1 | iex
$ErrorActionPreference = "Stop"

# True OS arch — RuntimeInformation/$env:PROCESSOR_ARCHITECTURE report X64 under
# x64-emulated PowerShell (5.1) on ARM64. The machine-level registry value is real.
$osArch = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' -Name PROCESSOR_ARCHITECTURE -ErrorAction SilentlyContinue).PROCESSOR_ARCHITECTURE
$arch = if ($osArch -eq 'ARM64') { 'arm64' } else { 'x64' }
$url  = "https://github.com/caponelvys/app-portal/releases/download/agent-latest/RavynCompanion-$arch.exe"
$dest = Join-Path $env:LOCALAPPDATA 'Ravyn'
$exe  = Join-Path $dest 'RavynCompanion.exe'

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Write-Host "[install] Downloading RavynCompanion ($arch)..."
Invoke-WebRequest -Uri $url -OutFile $exe

Write-Host "[install] Registering autostart (per-user Run key)..."
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' `
  -Name 'RavynCompanion' -Value ('"{0}"' -f $exe)

Write-Host "[install] (Re)starting the companion..."
Get-Process RavynCompanion -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process $exe

Write-Host "[install] Done -> $exe (starts at login, running now)."
Write-Host "[install] Look for the Ravyn icon in the system tray (click ^ to show hidden icons)."
