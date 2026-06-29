#!/bin/bash
# App Controller Agent — Mac Installer
# Run with: sudo bash install_mac.sh

set -e

AGENT_DIR="/usr/local/appcontroller"
VENV_DIR="$AGENT_DIR/venv"
PLIST="/Library/LaunchDaemons/com.appcontroller.agent.plist"

echo "[install] Creating agent directory..."
mkdir -p "$AGENT_DIR"
cp agent.py "$AGENT_DIR/agent.py"
cp requirements.txt "$AGENT_DIR/requirements.txt"

echo "[install] Creating Python virtual environment..."
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install -r "$AGENT_DIR/requirements.txt" --quiet

echo "[install] Creating launch daemon..."
cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.appcontroller.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>$VENV_DIR/bin/python3</string>
    <string>$AGENT_DIR/agent.py</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/var/log/appcontroller.log</string>
  <key>StandardErrorPath</key>
  <string>/var/log/appcontroller.log</string>
</dict>
</plist>
EOF

echo "[install] Starting agent service..."
launchctl load "$PLIST"

echo "[install] Done! Agent is running."
echo "[install] Logs: tail -f /var/log/appcontroller.log"
