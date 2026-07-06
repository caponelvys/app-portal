#!/bin/bash
# Uninstall the Ravyn Companion for the current user: stop + unregister the
# LaunchAgent and remove the app. Reverses install-companion.sh. It also clears
# the fleet-wide /Applications copy that the agent's install_mac.sh drops (needs
# sudo for that one). Run on macOS:  bash uninstall-companion.sh
set -uo pipefail

LABEL="app.ravyn.companion"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_NUM="$(id -u)"

echo "[uninstall] Stopping + unregistering the LaunchAgent…"
launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
pkill -f "Ravyn.app/Contents/MacOS/Ravyn" 2>/dev/null || true

echo "[uninstall] Removing LaunchAgent plist…"
rm -f "$PLIST"

echo "[uninstall] Removing the app…"
rm -rf "$HOME/Applications/Ravyn.app"
if [ -d "/Applications/Ravyn.app" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    rm -rf "/Applications/Ravyn.app"
  else
    echo "[uninstall] /Applications/Ravyn.app exists (fleet install) — removing with sudo…"
    sudo rm -rf "/Applications/Ravyn.app" 2>/dev/null || \
      echo "[uninstall] WARN: could not remove /Applications/Ravyn.app — rerun with sudo."
  fi
fi

echo "[uninstall] Done — Ravyn Companion removed. (The Ravyn Agent, if installed, is untouched.)"
