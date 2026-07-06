#!/bin/bash
# Install the Ravyn Companion for the current user: copy the app to
# ~/Applications and register a per-user LaunchAgent so it starts at login
# (and restarts if it quits). Run on macOS:  bash install-companion.sh
# The eventual fleet installer (install_mac.sh) will do the system-wide version.
set -euo pipefail
cd "$(dirname "$0")"

# Build if needed.
[ -d "Ravyn.app" ] || bash build.sh

LABEL="app.ravyn.companion"
DEST="$HOME/Applications"
APP="$DEST/Ravyn.app"
BIN="$APP/Contents/MacOS/Ravyn"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_NUM="$(id -u)"

echo "[install] Stopping any running instance…"
launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
pkill -f "Ravyn.app/Contents/MacOS/Ravyn" 2>/dev/null || true
sleep 1

echo "[install] Copying app → $APP"
mkdir -p "$DEST"
rm -rf "$APP"
cp -R Ravyn.app "$APP"

echo "[install] Writing LaunchAgent → $PLIST"
mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$BIN</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
</dict>
</plist>
PL

echo "[install] Loading LaunchAgent…"
launchctl bootstrap "gui/$UID_NUM" "$PLIST"

sleep 2
if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
  echo "[install] Done — Ravyn Companion is registered and running; it will start at login."
else
  echo "[install] WARN: LaunchAgent not found after bootstrap — check 'launchctl print gui/$UID_NUM/$LABEL'."
fi
