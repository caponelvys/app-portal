# Build + install the Ravyn Companion (Windows). Requires the .NET 8 SDK.
# Run in PowerShell (no admin needed):  .\build.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# True OS arch — RuntimeInformation reports X64 under x64-emulated PowerShell on
# ARM64. The machine-level registry value is real even under emulation.
$osArch = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' -Name PROCESSOR_ARCHITECTURE -ErrorAction SilentlyContinue).PROCESSOR_ARCHITECTURE
$rid  = if ($osArch -eq "ARM64") { "win-arm64" } else { "win-x64" }
Write-Host "[build] Publishing self-contained single-file ($rid)..."
dotnet publish -c Release -r $rid --self-contained true -p:PublishSingleFile=true -o publish

$dest = Join-Path $env:LOCALAPPDATA "Ravyn"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Force publish\RavynCompanion.exe $dest\RavynCompanion.exe
$exe = Join-Path $dest "RavynCompanion.exe"

Write-Host "[build] Registering autostart (per-user Run key)..."
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" `
  -Name "RavynCompanion" -Value ('"{0}"' -f $exe)

Write-Host "[build] (Re)starting the companion..."
Get-Process RavynCompanion -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process $exe

Write-Host "[build] Done -> installed to $dest, starts at login, and is running now."
Write-Host "[build] Look for the Ravyn icon in the system tray (click the ^ to show hidden icons)."
