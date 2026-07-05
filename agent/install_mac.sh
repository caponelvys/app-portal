#!/bin/bash
# Ravyn Agent — Mac Installer
# Run with: sudo bash install_mac.sh [--token <enrollment_token>]

set -e

AGENT_DIR="/usr/local/ravyn"
VENV_DIR="$AGENT_DIR/venv"
PLIST="/Library/LaunchDaemons/com.ravyn.agent.plist"
BASE_URL="https://appcontroller.vercel.app/downloads"

# Optional: --token <enrollment-token> places this device into a location.
TOKEN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "[install] Creating agent directory..."
mkdir -p "$AGENT_DIR"

echo "[install] Downloading agent files..."
# Download to a temp file and validate before installing, so a bad response
# (HTML error page, deploy race) can never overwrite the agent with garbage.
TMP_AGENT="$AGENT_DIR/agent.py.new"
curl -fsSL "$BASE_URL/agent.py" -o "$TMP_AGENT"
if head -c 300 "$TMP_AGENT" | grep -qiE '<!doctype|<html|<script|__next'; then
  echo "[install] ERROR: downloaded agent.py looks like HTML, not Python. Aborting."
  rm -f "$TMP_AGENT"; exit 1
fi
if ! python3 -m py_compile "$TMP_AGENT" 2>/dev/null; then
  echo "[install] ERROR: downloaded agent.py failed to compile. Aborting."
  rm -f "$TMP_AGENT"; exit 1
fi
[ -f "$AGENT_DIR/agent.py" ] && cp "$AGENT_DIR/agent.py" "$AGENT_DIR/agent.py.bak"
mv "$TMP_AGENT" "$AGENT_DIR/agent.py"
curl -fsSL "$BASE_URL/requirements.txt" -o "$AGENT_DIR/requirements.txt"

if [ -n "$TOKEN" ]; then
  echo "$TOKEN" > "$AGENT_DIR/.enrollment_token"
  echo "[install] Enrollment token saved."
fi

echo "[install] Creating Python virtual environment..."
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install -r "$AGENT_DIR/requirements.txt" --quiet

# Remove any prior "App Controller" daemon (pre-rebrand) so we don't run two
# agents. The old data dir is left in place so the agent can migrate its identity.
launchctl bootout system/com.appcontroller.agent 2>/dev/null || true
rm -f /Library/LaunchDaemons/com.appcontroller.agent.plist

echo "[install] Creating launch daemon..."
cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ravyn.agent</string>
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
  <string>/var/log/ravyn-agent.log</string>
  <key>StandardErrorPath</key>
  <string>/var/log/ravyn-agent.log</string>
</dict>
</plist>
EOF

echo "[install] Starting agent service..."
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "[install] Done! Agent is running."
echo "[install] Logs: tail -f /var/log/ravyn-agent.log"
