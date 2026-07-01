#!/bin/bash
# App Controller Agent — Linux Installer
# Run with: sudo bash install_linux.sh [--token <enrollment_token>]

set -e

AGENT_DIR="/usr/local/appcontroller"
VENV_DIR="$AGENT_DIR/venv"
SERVICE_FILE="/etc/systemd/system/appcontroller.service"
BASE_URL="https://appcontroller.vercel.app/downloads"

# Parse optional --token argument
TOKEN=""
while [[ $# -gt 0 ]]; do
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

# Save enrollment token if provided
if [ -n "$TOKEN" ]; then
  echo "$TOKEN" > "$AGENT_DIR/.enrollment_token"
  echo "[install] Enrollment token saved."
fi

echo "[install] Creating Python virtual environment..."
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install -r "$AGENT_DIR/requirements.txt" --quiet

echo "[install] Creating systemd service..."
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=App Controller Agent
After=network.target

[Service]
ExecStart=$VENV_DIR/bin/python3 $AGENT_DIR/agent.py
Restart=always
RestartSec=5
StandardOutput=append:/var/log/appcontroller.log
StandardError=append:/var/log/appcontroller.log

[Install]
WantedBy=multi-user.target
EOF

echo "[install] Enabling and starting service..."
systemctl daemon-reload
systemctl enable appcontroller
systemctl start appcontroller

echo "[install] Done! Agent is running."
echo "[install] Logs: journalctl -u appcontroller -f"
echo "[install] Or:   tail -f /var/log/appcontroller.log"
