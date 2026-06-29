"""
App Controller Agent
Runs as a background service on Mac, Linux, and Windows.
Polls Supabase every 5 seconds, kills any blocked apps that are running.
"""

import os
import sys
import time
import uuid
import socket
import string
import secrets
import platform
import subprocess
import requests
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://fdnqjwezvkcpwckyqmbg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbnFqd2V6dmtjcHdja3lxbWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzkxMjQsImV4cCI6MjA5ODI1NTEyNH0.NgcjU6gT9pdhteRK18QYcwYZE-iaiFmCYqwDgD2ow-8"
POLL_INTERVAL = 5  # seconds between checks
ACCESS_LOG_INTERVAL = 1800  # seconds; throttle "accessed" logging per app (30 min)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

OS = platform.system()  # "Darwin" (Mac) or "Windows"
DEVICE_ID_FILE = "C:\\AppController\\.device_id" if OS == "Windows" else "/usr/local/appcontroller/.device_id"
PAIRING_CODE_FILE = "C:\\AppController\\.pairing_code" if OS == "Windows" else "/usr/local/appcontroller/.pairing_code"
PORTAL_URL = "https://appcontroller.vercel.app/devices"

# Characters used for pairing codes — omit visually ambiguous ones (0/O, 1/I).
PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

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

# ── Device pairing ──────────────────────────────────────────────────────────────
def generate_pairing_code():
    """Create a stable local pairing code, reusing the saved one if present."""
    if os.path.exists(PAIRING_CODE_FILE):
        with open(PAIRING_CODE_FILE, "r") as f:
            existing = f.read().strip()
            if existing:
                return existing
    code = "".join(secrets.choice(PAIRING_ALPHABET) for _ in range(6))
    with open(PAIRING_CODE_FILE, "w") as f:
        f.write(code)
    return code

def setup_pairing(device_id):
    """If this device hasn't been claimed yet, publish a pairing code and show
    the user how to claim it. Once claimed, the code is removed locally."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}&select=user_id",
        headers=HEADERS,
    )
    claimed = resp.status_code == 200 and resp.json() and resp.json()[0].get("user_id")

    if claimed:
        if os.path.exists(PAIRING_CODE_FILE):
            os.remove(PAIRING_CODE_FILE)
        print("[agent] Device is paired to a user — per-user access rules active.")
        return

    code = generate_pairing_code()
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}",
        headers=HEADERS,
        json={"pairing_code": code},
    )
    print("\n" + "=" * 44)
    print("  This device is not yet linked to a user.")
    print(f"  Pairing code:  {code}")
    print(f"  Enter it at:   {PORTAL_URL}")
    print("=" * 44 + "\n")

# ── App enforcement ────────────────────────────────────────────────────────────
def get_blocked_apps():
    """Fetch all blocked apps that have a process_name set."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/apps?status=eq.blocked&process_name=not.is.null&select=id,name,process_name",
        headers=HEADERS,
    )
    if resp.status_code == 200:
        return resp.json()
    return []

def get_device_user(device_id):
    """Return the user_id that has claimed this device, or None if unclaimed."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}&select=user_id",
        headers=HEADERS,
    )
    if resp.status_code == 200 and resp.json():
        return resp.json()[0].get("user_id")
    return None

def get_granted_app_ids(user_id):
    """Return the set of app IDs this user has an active approved grant for.

    A grant is active when status is 'approved' and it either never expires
    (expires_at is null) or its expiry is still in the future.
    """
    if not user_id:
        return set()
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/app_requests"
        f"?user_id=eq.{user_id}&status=eq.approved&select=app_id,expires_at",
        headers=HEADERS,
    )
    if resp.status_code != 200:
        return set()

    granted = set()
    now = datetime.now(timezone.utc)
    for row in resp.json():
        expires_at = row.get("expires_at")
        if not expires_at:
            granted.add(row["app_id"])
            continue
        try:
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expiry > now:
                granted.add(row["app_id"])
        except (ValueError, AttributeError):
            # Unparseable expiry — fail safe by NOT granting access.
            pass
    return granted

def get_running_processes():
    """Return a set of currently running process names (lowercase)."""
    try:
        if OS == "Darwin":  # Mac
            out = subprocess.check_output(["ps", "-eo", "comm"], text=True)
            return {os.path.basename(line.strip()).lower() for line in out.splitlines()[1:] if line.strip()}
        elif OS == "Linux":
            out = subprocess.check_output(["ps", "-eo", "comm"], text=True)
            return {os.path.basename(line.strip()).lower() for line in out.splitlines()[1:] if line.strip()}
        elif OS == "Windows":
            out = subprocess.check_output(["tasklist", "/fo", "csv", "/nh"], text=True)
            return {line.split(",")[0].strip('"').lower() for line in out.splitlines() if line}
    except Exception as e:
        print(f"[error] Could not list processes: {e}")
        return set()

def kill_process(process_name):
    """Kill all instances of a process by name."""
    try:
        if OS in ("Darwin", "Linux"):
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
    setup_pairing(device_id)

    last_access_log = {}  # app_id -> last time we logged an "accessed" event

    while True:
        try:
            heartbeat(device_id)
            all_blocked = get_blocked_apps()

            # Per-user temporary access: if this device has been claimed by a
            # user, don't kill apps that user has an active approved grant for.
            owner_id = get_device_user(device_id)
            granted_ids = get_granted_app_ids(owner_id)
            granted_apps = [a for a in all_blocked if a.get("id") in granted_ids]
            blocked_apps = [a for a in all_blocked if a.get("id") not in granted_ids]

            running = get_running_processes()

            # Audit log: record when a granted app is actually in use (throttled
            # per app so we don't write an event on every 5s poll).
            now_ts = time.time()
            for app in granted_apps:
                pname = app["process_name"].lower()
                pname_exe = pname if pname.endswith(".exe") else pname + ".exe"
                if pname in running or (OS == "Windows" and pname_exe in running):
                    if now_ts - last_access_log.get(app["id"], 0) >= ACCESS_LOG_INTERVAL:
                        log_action(device_id, app["name"], "accessed")
                        last_access_log[app["id"]] = now_ts

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
