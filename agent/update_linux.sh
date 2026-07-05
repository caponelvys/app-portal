#!/bin/bash
# Ravyn Agent — Linux Updater
# Safely replaces agent.py with the latest version and restarts the service.
# Run with: sudo bash update_linux.sh

set -e

AGENT_DIR="/usr/local/ravyn"
BASE_URL="https://appcontroller.vercel.app/downloads"

if [ ! -f "$AGENT_DIR/agent.py" ]; then
  echo "[update] Agent is not installed. Run the installer first."
  exit 1
fi

echo "[update] Downloading latest agent..."
TMP_AGENT="$AGENT_DIR/agent.py.new"
curl -fsSL "$BASE_URL/agent.py" -o "$TMP_AGENT"

# Validate before touching the running agent: reject HTML / anything that
# won't compile, so a bad download can never brick the agent.
if head -c 300 "$TMP_AGENT" | grep -qiE '<!doctype|<html|<script|__next'; then
  echo "[update] ERROR: download looks like HTML, not the agent. Current agent left untouched."
  rm -f "$TMP_AGENT"; exit 1
fi
if ! python3 -m py_compile "$TMP_AGENT" 2>/dev/null; then
  echo "[update] ERROR: downloaded agent failed to compile. Current agent left untouched."
  rm -f "$TMP_AGENT"; exit 1
fi

echo "[update] Backing up and installing new agent..."
cp "$AGENT_DIR/agent.py" "$AGENT_DIR/agent.py.bak"
mv "$TMP_AGENT" "$AGENT_DIR/agent.py"

echo "[update] Restarting agent..."
if ! systemctl restart ravyn-agent; then
  echo "[update] Restart failed — rolling back to previous agent."
  mv "$AGENT_DIR/agent.py.bak" "$AGENT_DIR/agent.py"
  systemctl restart ravyn-agent || true
  exit 1
fi

echo "[update] Done. Agent updated and restarted."
