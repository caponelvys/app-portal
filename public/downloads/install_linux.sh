#!/bin/bash
# App Controller Agent — Linux Installer
# Run with: sudo bash install_linux.sh

set -e

AGENT_DIR="/usr/local/appcontroller"
VENV_DIR="$AGENT_DIR/venv"
SERVICE_FILE="/etc/systemd/system/appcontroller.service"

echo "[install] Creating agent directory..."
mkdir -p "$AGENT_DIR"
cp agent.py "$AGENT_DIR/agent.py"
cp requirements.txt "$AGENT_DIR/requirements.txt"

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
