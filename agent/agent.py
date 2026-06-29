"""
App Controller Agent
Runs as a background service on Mac and Windows.
Polls Supabase every 30 seconds, kills any blocked apps that are running.
"""

import os
import sys
import time
import uuid
import socket
import platform
import subprocess
import requests
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://fdnqjwezvkcpwckyqmbg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbnFqd2V6dmtjcHdja3lxbWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzkxMjQsImV4cCI6MjA5ODI1NTEyNH0.NgcjU6gT9pdhteRK18QYcwYZE-iaiFmCYqwDgD2ow-8"
POLL_INTERVAL = 5  # seconds between checks

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

OS = platform.system()  # "Darwin" (Mac) or "Windows"
DEVICE_ID_FILE = "C:\\AppController\\.device_id" if OS == "Windows" else "/usr/local/appcontroller/.device_id"

# ── Device identity ────────────────────────────────────────────────────────────
def get_device_id():
    """Get or create a stable unique ID for this machine."""
    if os.path.exists(DEVICE_ID_FILE):
        with open(DEVICE_ID_FILE, "r") as f:
            return f.read().strip()
    device_id = str(uuid.uuid4())
    with open(DEVICE_ID_FILE, "w") as f:
        f.write(device_id)
    return device_id

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def register_device(device_id):
    """Tell Supabase this device is enrolled."""
    data = {
        "device_id": device_id,
        "hostname": socket.gethostname(),
        "os": OS,
        "last_seen": now_iso(),
    }
    # Upsert — insert if new, update last_seen if existing
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/devices?on_conflict=device_id",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        json=data,
    )
    if resp.status_code not in (200, 201):
        print(f"[agent] Register failed: {resp.status_code} {resp.text}")

def heartbeat(device_id):
    """Update last_seen timestamp so the portal knows the agent is alive."""
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}",
        headers=HEADERS,
        json={"last_seen": now_iso()},
    )

# ── App enforcement ────────────────────────────────────────────────────────────
def get_blocked_apps():
    """Fetch all blocked apps that have a process_name set."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/apps?status=eq.blocked&process_name=not.is.null&select=name,process_name",
        headers=HEADERS,
    )
    if resp.status_code == 200:
        return resp.json()
    return []

def get_running_processes():
    """Return a set of currently running process names (lowercase)."""
    try:
        if OS == "Darwin":  # Mac
            out = subprocess.check_output(["ps", "-eo", "comm"], text=True)
            # ps comm includes full path on some systems, grab just the filename
            return {os.path.basename(line.strip()).lower() for line in out.splitlines()[1:] if line.strip()}
        elif OS == "Windows":
            out = subprocess.check_output(["tasklist", "/fo", "csv", "/nh"], text=True)
            # tasklist CSV format: "process.exe","PID",...
            return {line.split(",")[0].strip('"').lower() for line in out.splitlines() if line}
    except Exception as e:
        print(f"[error] Could not list processes: {e}")
        return set()

def kill_process(process_name):
    """Kill all instances of a process by name."""
    try:
        if OS == "Darwin":
            subprocess.run(["pkill", "-i", process_name], capture_output=True)
        elif OS == "Windows":
            subprocess.run(["taskkill", "/f", "/im", process_name], capture_output=True)
        return True
    except Exception as e:
        print(f"[error] Could not kill {process_name}: {e}")
        return False

def log_action(device_id, app_name, action):
    """Write a log entry to Supabase."""
    requests.post(
        f"{SUPABASE_URL}/rest/v1/agent_logs",
        headers=HEADERS,
        json={"device_id": device_id, "app_name": app_name, "action": action},
    )

# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    device_id = get_device_id()
    print(f"[agent] Starting — device ID: {device_id}")
    print(f"[agent] OS: {OS} | Polling every {POLL_INTERVAL}s")

    register_device(device_id)

    while True:
        try:
            heartbeat(device_id)
            blocked_apps = get_blocked_apps()
            running = get_running_processes()

            for app in blocked_apps:
                process_name = app["process_name"].lower()
                # On Windows processes end in .exe, handle both cases
                process_name_exe = process_name if process_name.endswith(".exe") else process_name + ".exe"

                match = process_name in running or (OS == "Windows" and process_name_exe in running)

                if match:
                    actual_name = process_name_exe if OS == "Windows" else process_name
                    print(f"[agent] Blocking: {app['name']} ({actual_name})")
                    killed = kill_process(actual_name)
                    if killed:
                        log_action(device_id, app["name"], "killed")

        except Exception as e:
            print(f"[agent] Error during check: {e}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
