"""
App Controller Agent
Runs as a background service on Mac, Linux, and Windows.
Polls Supabase every 5 seconds, kills any blocked apps that are running.
"""

import os
import sys
import time
import uuid
import shutil
import socket
import string
import secrets
import hashlib
import platform
import subprocess
import requests
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://fdnqjwezvkcpwckyqmbg.supabase.co"
PORTAL_URL   = "https://appcontroller.vercel.app"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbnFqd2V6dmtjcHdja3lxbWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzkxMjQsImV4cCI6MjA5ODI1NTEyNH0.NgcjU6gT9pdhteRK18QYcwYZE-iaiFmCYqwDgD2ow-8"
POLL_INTERVAL = 5  # seconds between checks
ACCESS_LOG_INTERVAL = 1800  # seconds; throttle "accessed" logging per app (30 min)
UPDATE_CHECK_INTERVAL = 300  # seconds between auto-update checks (5 min)
NET_FAIL_ESCALATE = 3  # consecutive failed polls before a network issue is logged as an error
NOTIFY_INTERVAL = 60  # seconds; throttle "app blocked" notifications per app so retries don't spam
AGENT_VERSION = "1.7.0"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

OS = platform.system()  # "Darwin" (Mac), "Windows", or "Linux"

def get_os_label():
    """Return a human-readable OS name with version, e.g. 'macOS 14.5'."""
    if OS == "Darwin":
        ver = platform.mac_ver()[0]  # e.g. '14.5'
        return f"macOS {ver}" if ver else "macOS"
    if OS == "Windows":
        ver = platform.win32_ver()  # (release, version, csd, ptype)
        name = ver[0] or "Windows"  # e.g. '11' or '10'
        build = ver[1].split(".")[-1] if ver[1] else ""
        return f"Windows {name}" + (f" (build {build})" if build else "")
    if OS == "Linux":
        try:
            info = platform.freedesktop_os_release()
            return info.get("PRETTY_NAME") or info.get("NAME", "Linux")
        except Exception:
            return f"Linux {platform.release()}"
    return OS

OS_LABEL = get_os_label()  # e.g. "macOS 14.5"
DEVICE_ID_FILE = "C:\\AppController\\.device_id" if OS == "Windows" else "/usr/local/appcontroller/.device_id"
PAIRING_CODE_FILE = "C:\\AppController\\.pairing_code" if OS == "Windows" else "/usr/local/appcontroller/.pairing_code"
ENROLLMENT_TOKEN_FILE = "C:\\AppController\\.enrollment_token" if OS == "Windows" else "/usr/local/appcontroller/.enrollment_token"
# User-facing page where a device owner enters their pairing code. Kept separate
# from PORTAL_URL (the API base) so it can't break the /api/enroll endpoint.
PAIRING_URL = "https://appcontroller.vercel.app/devices"

# Auto-update: poll the portal for the latest published version and self-update.
DOWNLOAD_BASE = "https://appcontroller.vercel.app/downloads"
VERSION_URL   = f"{PORTAL_URL}/api/agent/version"
# When packaged as a Windows .exe (PyInstaller), we run "frozen": there's no
# agent.py to swap and sys.executable is the bundled exe itself. Updates then
# pull a new .exe from the GitHub release instead of agent.py from the portal.
IS_FROZEN     = getattr(sys, "frozen", False)
AGENT_FILE    = sys.executable if IS_FROZEN else os.path.abspath(__file__)
EXE_URL       = "https://github.com/caponelvys/app-portal/releases/download/agent-latest/AppControllerAgent.exe"

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

def get_enrollment_token():
    """Read the location enrollment token from --token (saved on first run) or
    the token file written by the installer."""
    if "--token" in sys.argv:
        try:
            token = sys.argv[sys.argv.index("--token") + 1].strip()
            if token:
                with open(ENROLLMENT_TOKEN_FILE, "w") as f:
                    f.write(token)
                return token
        except IndexError:
            pass
    if os.path.exists(ENROLLMENT_TOKEN_FILE):
        with open(ENROLLMENT_TOKEN_FILE, "r") as f:
            return f.read().strip() or None
    return None

def register_device(device_id):
    """Register/update this device via the portal enroll API.
    The portal validates the enrollment token server-side so the token
    never needs to be readable by the anon key."""
    payload = {
        "device_id": device_id,
        "hostname":  socket.gethostname(),
        "os":        OS_LABEL,
    }
    token = get_enrollment_token()
    if token:
        payload["token"] = token

    resp = requests.post(
        f"{PORTAL_URL}/api/enroll",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=10,
    )
    if resp.status_code == 200:
        data = resp.json()
        if token and data.get("location_id"):
            print(f"[agent] Enrolled into location {data['location_id']}")
            log_event(device_id, "info", "enrolled", f"Enrolled into location {data['location_id']}")
    else:
        print(f"[agent] Enroll failed: {resp.status_code} {resp.text}")
        log_event(device_id, "error", "enroll_failed", f"{resp.status_code} {resp.text[:200]}")

def get_device_user():
    """Detect the console/logged-in OS username. The agent runs as root/SYSTEM,
    so we look up the active console user rather than the process owner.
    Returns None if no interactive user is logged in."""
    try:
        if OS == "Darwin":
            out = subprocess.check_output(["stat", "-f", "%Su", "/dev/console"], text=True).strip()
            return out if out and out != "root" else None
        if OS == "Linux":
            out = subprocess.check_output(["who"], text=True)
            for line in out.splitlines():
                parts = line.split()
                if parts and parts[0] != "root":
                    return parts[0]
            return None
        if OS == "Windows":
            try:
                out = subprocess.check_output(["quser"], text=True, stderr=subprocess.DEVNULL)
                for line in out.splitlines()[1:]:
                    parts = line.split()
                    if parts:
                        return parts[0].lstrip(">")
            except Exception:
                out = subprocess.check_output(["wmic", "computersystem", "get", "username"], text=True)
                for line in out.splitlines():
                    v = line.strip()
                    if v and v.lower() != "username":
                        return v.split("\\")[-1]
            return None
    except Exception:
        pass
    return None

def get_local_ip():
    """Return the machine's outbound IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return None

def heartbeat(device_id):
    """Update last_seen, agent version, and IP so the portal has current info."""
    try:
        payload = {
            "last_seen":     now_iso(),
            "agent_version": AGENT_VERSION,
        }
        ip = get_local_ip()
        if ip:
            payload["ip_address"] = ip
        device_user = get_device_user()
        if device_user:
            payload["device_user"] = device_user
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}",
            headers=HEADERS,
            json=payload,
            timeout=5,
        )
    except Exception:
        pass  # transient network error — next heartbeat will catch up

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
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}&select=user_id",
            headers=HEADERS,
            timeout=10,
        )
        claimed = resp.status_code == 200 and resp.json() and resp.json()[0].get("user_id")
    except Exception as e:
        print(f"[agent] Warning: pairing check failed ({e}), assuming unclaimed")
        claimed = False

    if claimed:
        if os.path.exists(PAIRING_CODE_FILE):
            os.remove(PAIRING_CODE_FILE)
        print("[agent] Device is paired to a user — per-user access rules active.")
        log_event(device_id, "info", "paired", "Device paired to a user")
        return

    code = generate_pairing_code()
    try:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}",
            headers=HEADERS,
            json={"pairing_code": code},
            timeout=10,
        )
    except Exception:
        pass
    print("\n" + "=" * 44)
    print("  This device is not yet linked to a user.")
    print(f"  Pairing code:  {code}")
    print(f"  Enter it at:   {PAIRING_URL}")
    print("=" * 44 + "\n")

# ── App enforcement ────────────────────────────────────────────────────────────
def get_all_apps():
    """Fetch the app catalog. `status` is the global default policy."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/apps?process_name=not.is.null&select=id,name,process_name,status",
        headers=HEADERS,
    )
    if resp.status_code == 200:
        return resp.json()
    return []

def get_device_context(device_id):
    """Return {user_id, org_id, location_id, pending_command} for this device."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}&select=user_id,org_id,location_id,pending_command",
        headers=HEADERS,
    )
    if resp.status_code == 200 and resp.json():
        return resp.json()[0]
    return {}

def get_policies(scope_ids):
    """Fetch policy overrides for the given org/location/device scope IDs."""
    ids = [s for s in scope_ids if s]
    if not ids:
        return []
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/app_policies?scope_id=in.({','.join(ids)})&select=app_id,scope_id,status",
        headers=HEADERS,
    )
    if resp.status_code == 200:
        return resp.json()
    return []

def resolve_effective_blocked(apps, policies, ctx, device_id):
    """Resolve effective status per app and return those effectively blocked.
    Most specific override wins: device > location > org > global default."""
    dev, loc, org = {}, {}, {}
    for p in policies:
        sid = p.get("scope_id")
        if sid == device_id:
            dev[p["app_id"]] = p["status"]
        elif sid == ctx.get("location_id"):
            loc[p["app_id"]] = p["status"]
        elif sid == ctx.get("org_id"):
            org[p["app_id"]] = p["status"]

    blocked = []
    for app in apps:
        status = dev.get(app["id"]) or loc.get(app["id"]) or org.get(app["id"]) or app.get("status")
        if status == "blocked":
            blocked.append(app)
    return blocked

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

def notify_user(title, message):
    """Show a native notification banner to the logged-in user explaining why an
    app was closed. The agent runs as root/SYSTEM, so the notification must be
    dispatched into the console user's GUI session. Best-effort — a failure here
    must never disrupt enforcement. Windows has no reliable toast from the SYSTEM
    session, so it falls back to a msg.exe message box."""
    user = get_device_user()
    if not user:
        return  # no interactive user logged in — nobody to notify
    # Quotes would break the osascript string; app names are admin-controlled but
    # sanitize anyway.
    title = title.replace('"', "'")
    message = message.replace('"', "'")
    try:
        if OS == "Darwin":
            uid = subprocess.check_output(["id", "-u", user], text=True).strip()
            script = f'display notification "{message}" with title "{title}"'
            subprocess.run(["launchctl", "asuser", uid, "osascript", "-e", script],
                           capture_output=True, timeout=5)
        elif OS == "Linux":
            uid = subprocess.check_output(["id", "-u", user], text=True).strip()
            env = {**os.environ, "DISPLAY": ":0",
                   "DBUS_SESSION_BUS_ADDRESS": f"unix:path=/run/user/{uid}/bus"}
            subprocess.run(["sudo", "-u", user, "notify-send", title, message],
                           capture_output=True, timeout=5, env=env)
        elif OS == "Windows":
            subprocess.run(["msg", user, f"{title}: {message}"], capture_output=True, timeout=5)
    except Exception as e:
        print(f"[agent] Could not notify user: {e}")

def log_action(device_id, app_name, action):
    """Write a log entry to Supabase."""
    requests.post(
        f"{SUPABASE_URL}/rest/v1/agent_logs",
        headers=HEADERS,
        json={"device_id": device_id, "app_name": app_name, "action": action},
    )

def log_event(device_id, level, event, message=""):
    """Best-effort structured activity event for the portal's per-device log.
    level: 'info' | 'warn' | 'error'. Failures are swallowed — logging must
    never disrupt the agent."""
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/agent_events",
            headers=HEADERS,
            json={
                "device_id": device_id,
                "level": level,
                "event": event,
                "message": (message or "")[:500],
            },
            timeout=5,
        )
    except Exception:
        pass

# ── Auto-update ───────────────────────────────────────────────────────────────
def get_latest_version():
    """Ask the portal for the latest published agent version, or None."""
    try:
        r = requests.get(VERSION_URL, timeout=10)
        if r.status_code == 200:
            v = r.json().get("version")
            if isinstance(v, str) and v.strip():
                return v.strip()
    except Exception:
        pass
    return None

def restart_agent():
    """Restart the process into the current (possibly just-updated) binary. On a
    frozen Windows exe, os.execv is unreliable, so spawn a detached copy and exit
    — the new process keeps running after this one goes away."""
    if IS_FROZEN and OS == "Windows":
        DETACHED = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        subprocess.Popen([sys.executable] + sys.argv[1:], creationflags=DETACHED, close_fds=True)
        os._exit(0)
    if IS_FROZEN:
        os.execv(sys.executable, [sys.executable] + sys.argv[1:])
    os.execv(sys.executable, [sys.executable, AGENT_FILE] + sys.argv[1:])

def _self_update_exe(device_id, latest):
    """Frozen (.exe) update: download the latest release exe, rename the running
    exe aside, move the new one into place, and restart. Windows lets you rename a
    running exe, so this is safe; a bad/identical download is rejected first."""
    try:
        r = requests.get(EXE_URL, timeout=180)
        if r.status_code != 200:
            return
        data = r.content
        if data[:2] != b"MZ":  # PE executables start with "MZ"
            log_event(device_id, "error", "update_failed", f"Update to {latest} rejected: download was not an .exe")
            return
        # Skip if the release exe is byte-identical to what we're running — avoids
        # an update loop during the window where CI hasn't published the new build.
        try:
            with open(sys.executable, "rb") as f:
                if hashlib.sha256(f.read()).digest() == hashlib.sha256(data).digest():
                    return
        except Exception:
            pass
        cur = sys.executable
        newp = os.path.join(os.path.dirname(cur), "agent.new.exe")
        oldp = cur + ".old"
        with open(newp, "wb") as f:
            f.write(data)
        try:
            if os.path.exists(oldp):
                os.remove(oldp)
        except Exception:
            pass
        os.replace(cur, oldp)   # rename the running exe out of the way
        os.replace(newp, cur)   # put the new exe at the original path
        print(f"[agent] Updated exe -> {latest}; restarting")
        log_event(device_id, "info", "update_applied", f"Updated {AGENT_VERSION} -> {latest}; restarting")
        restart_agent()
    except Exception as e:
        log_event(device_id, "error", "update_failed", f"Update to {latest} error: {e}")

def self_update(device_id, latest):
    """Download, validate, and swap in the latest agent, then re-exec into it.
    A bad download (HTML error page, wrong version, non-compiling code) is
    rejected before the running agent is touched — it can never brick itself."""
    if IS_FROZEN:
        return _self_update_exe(device_id, latest)
    try:
        r = requests.get(f"{DOWNLOAD_BASE}/agent.py", timeout=30)
        if r.status_code != 200:
            return
        source = r.text
        # Reject non-Python responses (deploy race / SPA fallback).
        if any(tag in source[:400].lower() for tag in ("<!doctype", "<html", "<script", "__next")):
            log_event(device_id, "error", "update_failed", f"Update to {latest} rejected: download was not Python")
            return
        # Reject anything that won't compile.
        try:
            compile(source, AGENT_FILE, "exec")
        except SyntaxError as e:
            log_event(device_id, "error", "update_failed", f"Update to {latest} rejected: {e}")
            return
        # Confirm the download really is the version the portal advertised.
        if f'AGENT_VERSION = "{latest}"' not in source:
            log_event(device_id, "error", "update_failed", f"Update aborted: downloaded agent is not v{latest}")
            return
        # Back up the current agent, install the new one, then re-exec.
        try:
            shutil.copy2(AGENT_FILE, AGENT_FILE + ".bak")
        except Exception:
            pass
        with open(AGENT_FILE, "w") as f:
            f.write(source)
        print(f"[agent] Updated {AGENT_VERSION} -> {latest}; restarting")
        log_event(device_id, "info", "update_applied", f"Updated {AGENT_VERSION} -> {latest}; restarting")
        restart_agent()
    except Exception as e:
        log_event(device_id, "error", "update_failed", f"Update to {latest} error: {e}")

# ── Remote commands ───────────────────────────────────────────────────────────
INSTALL_DIR = "C:\\AppController" if OS == "Windows" else "/usr/local/appcontroller"

def clear_command(device_id):
    """Clear the device's pending_command. Returns True on success."""
    try:
        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/devices?device_id=eq.{device_id}",
            headers=HEADERS, json={"pending_command": None}, timeout=5,
        )
        return r.status_code < 300
    except Exception:
        return False

def uninstall_agent():
    """Remove the service and installed files, then stop. Best-effort per OS."""
    try:
        if OS == "Darwin":
            plist = "/Library/LaunchDaemons/com.appcontroller.agent.plist"
            try: os.remove(plist)
            except Exception: pass
            shutil.rmtree(INSTALL_DIR, ignore_errors=True)
            subprocess.run(["launchctl", "bootout", "system/com.appcontroller.agent"], capture_output=True)
        elif OS == "Linux":
            subprocess.run(["systemctl", "disable", "--now", "appcontroller"], capture_output=True)
            try: os.remove("/etc/systemd/system/appcontroller.service")
            except Exception: pass
            subprocess.run(["systemctl", "daemon-reload"], capture_output=True)
            shutil.rmtree(INSTALL_DIR, ignore_errors=True)
        elif OS == "Windows":
            subprocess.run(["schtasks", "/delete", "/tn", "AppControllerAgent", "/f"], capture_output=True)
            shutil.rmtree(INSTALL_DIR, ignore_errors=True)
    except Exception as e:
        print(f"[agent] Uninstall error: {e}")
    finally:
        os._exit(0)

def handle_command(device_id, cmd):
    """Execute a portal-issued command. Clears it first so it runs at most once."""
    cmd = (cmd or "").strip().lower()
    if cmd not in ("restart", "update", "uninstall"):
        clear_command(device_id)
        return
    # Only act once we've cleared it, so a failed clear can't loop the command.
    if not clear_command(device_id):
        return
    if cmd == "restart":
        log_event(device_id, "info", "command_restart", "Restart requested from portal")
        restart_agent()
    elif cmd == "update":
        log_event(device_id, "info", "command_update", "Update requested from portal")
        latest = get_latest_version()
        if latest and latest != AGENT_VERSION:
            self_update(device_id, latest)  # re-execs on success
    elif cmd == "uninstall":
        log_event(device_id, "warn", "command_uninstall", "Uninstall requested from portal")
        uninstall_agent()  # terminal

# ── Remote app uninstall (device_commands queue) ──────────────────────────────
def get_app_detail(app_id):
    """Fetch one app with its install/uninstall metadata (not in the hot loop's
    lean app fetch)."""
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/apps?id=eq.{app_id}"
            "&select=id,name,process_name,mac_app_path,windows_uninstall,linux_package,"
            "mac_install_url,mac_install_sha256,windows_install_url,windows_install_sha256",
            headers=HEADERS, timeout=10)
        if resp.status_code == 200 and resp.json():
            return resp.json()[0]
    except Exception:
        pass
    return None

def update_command(cmd_id, status, result=None):
    """Write a command's status/result back to the portal. Best-effort."""
    try:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/device_commands?id=eq.{cmd_id}",
            headers=HEADERS,
            json={"status": status, "result": (result or "")[:500],
                  "updated_at": datetime.now(timezone.utc).isoformat()},
            timeout=10)
    except Exception:
        pass

def _uninstall_macos(app):
    # Prefer an explicit catalog path; else guess the bundle from the name.
    candidates = []
    if app.get("mac_app_path"):
        candidates.append(app["mac_app_path"])
    for nm in (app.get("name"), app.get("process_name")):
        if nm:
            candidates.append(f"/Applications/{nm}.app")
    seen = set()
    for p in candidates:
        norm = os.path.normpath(p) if p else ""
        if not norm or norm in seen:
            continue
        seen.add(norm)
        # Safety: only ever remove a *.app bundle sitting directly under
        # /Applications — never a nested path or anything else.
        inner = norm[len("/Applications/"):-len(".app")] if norm.startswith("/Applications/") and norm.endswith(".app") else None
        if not inner or "/" in inner:
            continue
        if os.path.isdir(norm):
            shutil.rmtree(norm)
            return True, f"Removed {norm}"
    return False, "No matching .app bundle found in /Applications"

def _reg_uninstall_string(name):
    """Search HKLM Uninstall keys (64- and 32-bit) for an app whose DisplayName
    matches `name`. Returns (display_name, command, is_quiet) or None. Prefers an
    exact DisplayName match. Windows only (winreg imported lazily)."""
    import winreg
    name_l = name.lower()
    best = None
    def val(k, n):
        try:
            v, _ = winreg.QueryValueEx(k, n)
            return v
        except OSError:
            return None
    roots = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    for hive, path in roots:
        try:
            root = winreg.OpenKey(hive, path)
        except OSError:
            continue
        for i in range(winreg.QueryInfoKey(root)[0]):
            try:
                with winreg.OpenKey(root, winreg.EnumKey(root, i)) as sk:
                    disp = val(sk, "DisplayName")
                    if not disp:
                        continue
                    d = disp.lower()
                    exact = d == name_l
                    if not exact and name_l not in d:
                        continue
                    quiet = val(sk, "QuietUninstallString")
                    cmd = quiet or val(sk, "UninstallString")
                    if not cmd:
                        continue
                    entry = (disp, cmd, quiet is not None)
                    if exact:
                        return entry
                    best = best or entry
            except OSError:
                continue
    return best

def _uninstall_windows_peruser(name):
    """Uninstall a per-user Windows app (Discord/Slack/Teams etc.). These install
    into the user's profile and register in the user's HKCU, which the SYSTEM
    service can't act on directly. Run the uninstall in the logged-in user's own
    session via a one-shot scheduled task with an interactive token (no stored
    password), and read the result the task writes. Best-effort.

    NOTE: untested on real Windows hardware — the /IT (interactive-token, no
    password) task creation is the key assumption to validate."""
    user = get_device_user()
    if not user:
        return False, "No interactive user logged in for a per-user uninstall"
    base = r"C:\ProgramData\AppController"
    script_path = base + r"\uninstall.ps1"
    result_path = base + r"\uninstall_result.txt"
    task = "AppController_Uninstall"
    safe = name.replace("'", "''")
    ps = (
        "$ErrorActionPreference='SilentlyContinue'\n"
        f"$target='{safe}'\n"
        f"$result='{result_path}'\n"
        "$app = Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' | "
        "ForEach-Object { Get-ItemProperty $_.PSPath } | "
        "Where-Object { $_.DisplayName -and ($_.DisplayName -eq $target -or $_.DisplayName -like \"*$target*\") } | "
        "Select-Object -First 1\n"
        "if (-not $app) { Set-Content -Path $result -Value 'NOTFOUND'; return }\n"
        "$cmd = if ($app.QuietUninstallString) { $app.QuietUninstallString } else { $app.UninstallString }\n"
        "if (-not $cmd) { Set-Content -Path $result -Value 'NOCMD'; return }\n"
        "try { $p = Start-Process -FilePath cmd.exe -ArgumentList '/c', $cmd -Wait -PassThru; "
        "Set-Content -Path $result -Value ('DONE ' + $p.ExitCode) } "
        "catch { Set-Content -Path $result -Value ('ERROR ' + $_.Exception.Message) }\n"
    )
    try:
        os.makedirs(base, exist_ok=True)
        with open(script_path, "w") as f:
            f.write(ps)
        if os.path.exists(result_path):
            os.remove(result_path)
        # One-shot task that runs as the logged-on user with an interactive token
        # (no stored password) so the uninstaller runs in the user's context.
        subprocess.run(["schtasks", "/create", "/tn", task, "/f", "/sc", "ONCE", "/st", "00:00",
                        "/ru", user, "/it", "/tr",
                        f'powershell -NoProfile -ExecutionPolicy Bypass -File "{script_path}"'],
                       capture_output=True, text=True, timeout=30)
        run = subprocess.run(["schtasks", "/run", "/tn", task], capture_output=True, text=True, timeout=30)
        if run.returncode != 0:
            subprocess.run(["schtasks", "/delete", "/tn", task, "/f"], capture_output=True, timeout=15)
            return False, f"Could not launch per-user uninstall task: {((run.stdout or '') + (run.stderr or ''))[-160:].strip()}"
        # Poll for the result the script writes (uninstallers can take a while).
        content = None
        deadline = time.time() + 180
        while time.time() < deadline:
            if os.path.exists(result_path):
                time.sleep(1)  # let the write finish
                with open(result_path) as f:
                    content = f.read().strip()
                break
            time.sleep(2)
        subprocess.run(["schtasks", "/delete", "/tn", task, "/f"], capture_output=True, timeout=15)
        if content is None:
            return False, "Per-user uninstall task did not report a result in time"
        if content == "NOTFOUND":
            return False, f"'{name}' not found in the user's installed apps"
        if content == "NOCMD":
            return False, f"'{name}' has no registered uninstall command"
        if content.startswith("DONE"):
            parts = content.split()
            code = parts[1] if len(parts) > 1 else "?"
            return (True, f"Uninstalled '{name}' (per-user)") if code == "0" else (False, f"Per-user uninstall exited {code}")
        if content.startswith("ERROR"):
            return False, f"Per-user uninstall error: {content[6:][:160]}"
        return False, f"Per-user uninstall: {content[:160]}"
    except Exception as e:
        return False, f"Per-user uninstall failed: {e}"

def _uninstall_windows(app):
    name = app.get("windows_uninstall") or app.get("name")
    if not name:
        return False, "No app name for uninstall"
    # winget rarely resolves from a SYSTEM service, but try it if it's on PATH.
    if shutil.which("winget"):
        r = subprocess.run(["winget", "uninstall", "--name", name, "--silent",
                            "--accept-source-agreements", "--disable-interactivity"],
                           capture_output=True, text=True, timeout=300)
        if r.returncode == 0:
            return True, f"winget uninstalled '{name}'"
    # Fallback: run the app's registered silent uninstall string from HKLM. Works
    # from SYSTEM for machine-wide installs. Per-user installs (Discord/Slack/
    # Teams) register in the user's HKCU and aren't visible here — set a
    # windows_uninstall override or target a machine-wide install for those.
    try:
        found = _reg_uninstall_string(name)
    except Exception:
        found = None
    if found:
        disp, cmd, quiet = found
        if not quiet and "msiexec" in cmd.lower():
            # An MSI UninstallString may be interactive (/I) — force a silent removal.
            cmd = cmd.replace("/I", "/X").replace("/i", "/X")
            if "/quiet" not in cmd.lower():
                cmd += " /quiet /norestart"
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=300)
        if r.returncode in (0, 3010):  # 3010 = success, restart required
            return True, f"Uninstalled '{disp}' via registry"
        return False, f"Uninstall of '{disp}' exited {r.returncode}: {((r.stdout or '') + (r.stderr or ''))[-160:].strip()}"
    # Not a machine-wide install — try the logged-in user's per-user apps.
    return _uninstall_windows_peruser(name)

def _uninstall_linux(app):
    pkg = app.get("linux_package") or app.get("process_name") or app.get("name")
    if not pkg:
        return False, "No package name for uninstall"
    tried = []
    for cmd, mgr in (["apt-get", "remove", "-y", pkg], "apt-get"), (["dnf", "remove", "-y", pkg], "dnf"), (["snap", "remove", pkg], "snap"), (["flatpak", "uninstall", "-y", pkg], "flatpak"):
        if shutil.which(cmd[0]):
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if r.returncode == 0:
                return True, f"{mgr} removed '{pkg}'"
            tried.append(mgr)
    return False, f"Removal failed via {', '.join(tried)}" if tried else "No supported package manager found"

def uninstall_app(app):
    """Best-effort uninstall of a managed app. Returns (success, detail)."""
    # Kill it first so files/bundles aren't locked.
    pname = (app.get("process_name") or "").lower()
    if pname:
        actual = pname + ".exe" if (OS == "Windows" and not pname.endswith(".exe")) else pname
        kill_process(actual)
    try:
        if OS == "Darwin":  return _uninstall_macos(app)
        if OS == "Windows": return _uninstall_windows(app)
        if OS == "Linux":   return _uninstall_linux(app)
        return False, f"Unsupported OS: {OS}"
    except Exception as e:
        return False, f"Uninstall error: {e}"

def _download_installer(url, expected_sha256):
    """Download an installer and, if a checksum is configured, verify it before
    use. Returns (data, error). A configured-but-mismatched checksum is a hard
    failure — we never run an installer whose digest doesn't match."""
    r = requests.get(url, timeout=180)
    if r.status_code != 200:
        return None, f"Download failed: HTTP {r.status_code}"
    data = r.content
    if expected_sha256:
        actual = hashlib.sha256(data).hexdigest()
        if actual.lower() != expected_sha256.strip().lower():
            return None, f"Checksum mismatch (expected {expected_sha256.strip()[:12]}…, got {actual[:12]}…)"
    return data, None

def _install_macos_pkg(data, url):
    import tempfile
    path = None
    try:
        fd, path = tempfile.mkstemp(suffix=".pkg")
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        p = subprocess.run(["installer", "-pkg", path, "-target", "/"],
                           capture_output=True, text=True, timeout=600)
        if p.returncode == 0:
            return True, f"Installed from {url}"
        return False, f"installer exited {p.returncode}: {((p.stdout or '') + (p.stderr or ''))[-160:].strip()}"
    finally:
        if path:
            try:
                os.remove(path)
            except Exception:
                pass

def _install_macos_dmg(data):
    """Mount a drag-to-Applications .dmg, copy the .app into /Applications, unmount."""
    import tempfile
    dmg_path = None
    mount = None
    try:
        fd, dmg_path = tempfile.mkstemp(suffix=".dmg")
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        mount = tempfile.mkdtemp(prefix="ac_dmg_")
        # Mount quietly; feed 'Y' in case the image carries a license agreement.
        att = subprocess.run(["hdiutil", "attach", dmg_path, "-nobrowse", "-noautoopen", "-mountpoint", mount],
                             input="Y\n", capture_output=True, text=True, timeout=120)
        if att.returncode != 0:
            return False, f"Could not mount .dmg: {((att.stdout or '') + (att.stderr or ''))[-160:].strip()}"
        apps = [e for e in os.listdir(mount) if e.endswith(".app")]
        if not apps:
            return False, "No .app bundle found inside the .dmg"
        src = os.path.join(mount, apps[0])
        dest = os.path.join("/Applications", apps[0])
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        # ditto preserves bundle permissions/metadata better than cp -R.
        cp = subprocess.run(["ditto", src, dest], capture_output=True, text=True, timeout=300)
        if cp.returncode != 0:
            return False, f"Copy failed: {((cp.stdout or '') + (cp.stderr or ''))[-160:].strip()}"
        return True, f"Installed {apps[0]} to /Applications"
    finally:
        if mount:
            subprocess.run(["hdiutil", "detach", mount, "-quiet", "-force"], capture_output=True, timeout=60)
            try:
                os.rmdir(mount)
            except Exception:
                pass
        if dmg_path:
            try:
                os.remove(dmg_path)
            except Exception:
                pass

def _install_macos_zip(data):
    """Install a .zip'd app bundle (many dev/media apps ship this way). ditto -x -k
    unpacks a PKZip preserving the bundle's perms/symlinks (Python's zipfile does
    not), then the .app is copied into /Applications."""
    import tempfile
    zpath = None
    tmpdir = None
    try:
        fd, zpath = tempfile.mkstemp(suffix=".zip")
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        tmpdir = tempfile.mkdtemp(prefix="ac_zip_")
        ex = subprocess.run(["ditto", "-x", "-k", zpath, tmpdir], capture_output=True, text=True, timeout=300)
        if ex.returncode != 0:
            return False, f"Could not unzip: {((ex.stdout or '') + (ex.stderr or ''))[-160:].strip()}"
        app_path = None
        for root, dirs, _ in os.walk(tmpdir):
            hit = next((d for d in dirs if d.endswith(".app")), None)
            if hit:
                app_path = os.path.join(root, hit)
                break
        if not app_path:
            return False, "No .app bundle found inside the .zip"
        name = os.path.basename(app_path)
        dest = os.path.join("/Applications", name)
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        cp = subprocess.run(["ditto", app_path, dest], capture_output=True, text=True, timeout=300)
        if cp.returncode != 0:
            return False, f"Copy failed: {((cp.stdout or '') + (cp.stderr or ''))[-160:].strip()}"
        return True, f"Installed {name} to /Applications"
    finally:
        if tmpdir:
            shutil.rmtree(tmpdir, ignore_errors=True)
        if zpath:
            try:
                os.remove(zpath)
            except Exception:
                pass

def _install_macos(app):
    url = app.get("mac_install_url")
    if not url:
        return False, "No macOS installer URL set (configure mac_install_url)"
    data, err = _download_installer(url, app.get("mac_install_sha256"))
    if err:
        return False, err
    # Detect by content, not URL/extension (installer URLs are often redirects):
    # xar → .pkg, PK → .zip, HTML → reject, anything else → let hdiutil try to
    # mount it as a disk image (.dmg / .iso / UDIF, in any layout).
    if data[:4] == b"xar!":
        return _install_macos_pkg(data, url)
    if data[:4] == b"PK\x03\x04":
        return _install_macos_zip(data)
    head = data[:200].lstrip().lower()
    if head.startswith(b"<!doctype") or head.startswith(b"<html") or b"<head" in head[:80]:
        return False, "Download was an HTML page, not an installer"
    return _install_macos_dmg(data)

def _install_windows(app):
    url = app.get("windows_install_url")
    if not url:
        return False, "No Windows installer URL set (configure windows_install_url)"
    data, err = _download_installer(url, app.get("windows_install_sha256"))
    if err:
        return False, err
    # An .msi is an OLE compound document (magic D0 CF 11 E0 A1 B1 1A E1).
    if data[:8] != b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return False, "Downloaded file is not a .msi installer"
    import tempfile
    path = None
    try:
        fd, path = tempfile.mkstemp(suffix=".msi")
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        p = subprocess.run(["msiexec", "/i", path, "/quiet", "/norestart"],
                           capture_output=True, text=True, timeout=600)
        if p.returncode in (0, 3010):  # 3010 = success, restart required
            return True, f"Installed from {url}"
        return False, f"msiexec exited {p.returncode}: {((p.stdout or '') + (p.stderr or ''))[-160:].strip()}"
    finally:
        if path:
            try:
                os.remove(path)
            except Exception:
                pass

def install_app(app):
    """Best-effort install from an admin-provided installer URL. macOS .pkg and
    Windows .msi. Returns (success, detail)."""
    try:
        if OS == "Darwin":
            return _install_macos(app)
        if OS == "Windows":
            return _install_windows(app)
        return False, f"Install not supported on {OS} yet"
    except Exception as e:
        return False, f"Install error: {e}"

def process_app_commands(device_id):
    """Run any pending portal-issued app commands (install/uninstall) for this
    device, writing the result back. Best-effort — never disrupts enforcement."""
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/device_commands"
            f"?device_id=eq.{device_id}&status=eq.pending&order=created_at.asc&select=id,type,app_id",
            headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return
        commands = resp.json()
    except Exception:
        return
    for cmd in commands:
        cid = cmd.get("id")
        ctype = cmd.get("type")
        if ctype not in ("uninstall_app", "install_app"):
            update_command(cid, "failed", f"Unknown command type: {ctype}")
            continue
        app = get_app_detail(cmd.get("app_id")) if cmd.get("app_id") else None
        if not app:
            update_command(cid, "failed", "App not found in catalog")
            continue
        update_command(cid, "running")
        if ctype == "install_app":
            ok, detail = install_app(app)
            ev_ok, ev_fail, verb = "install_app", "install_failed", "installed"
        else:
            ok, detail = uninstall_app(app)
            ev_ok, ev_fail, verb = "uninstall_app", "uninstall_failed", "uninstalled"
        update_command(cid, "done" if ok else "failed", detail)
        log_event(device_id, "info" if ok else "error",
                  ev_ok if ok else ev_fail,
                  f"{app.get('name', 'App')}: {detail}")
        if ok:
            notify_user("App Controller", f"{app.get('name', 'An app')} was {verb} by your administrator.")

# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    device_id = get_device_id()
    print(f"[agent] Starting — device ID: {device_id}")
    print(f"[agent] OS: {OS} | Polling every {POLL_INTERVAL}s")
    log_event(device_id, "info", "started", f"Agent v{AGENT_VERSION} started on {OS_LABEL}")

    # Remove the previous exe left behind by a frozen self-update.
    if IS_FROZEN and OS == "Windows":
        try:
            os.remove(sys.executable + ".old")
        except Exception:
            pass

    try:
        register_device(device_id)
    except Exception as e:
        print(f"[agent] Warning: registration failed ({e}), continuing anyway")
        log_event(device_id, "error", "enroll_failed", f"Registration error: {e}")
    setup_pairing(device_id)

    last_access_log = {}  # app_id -> last time we logged an "accessed" event
    last_notify = {}  # app_id -> last time we notified the user about a block
    last_error = {"msg": None, "ts": 0.0}  # throttle repeated error events
    last_update_check = 0.0  # 0 → check for updates on the first iteration
    consecutive_net_fails = 0  # run of back-to-back poll failures (network)

    while True:
        try:
            # Auto-update: converge to the latest published version. self_update
            # re-execs on success (never returns), so this runs before enforcement.
            now_upd = time.time()
            if now_upd - last_update_check >= UPDATE_CHECK_INTERVAL:
                last_update_check = now_upd
                latest = get_latest_version()
                if latest and latest != AGENT_VERSION:
                    print(f"[agent] Update available: {latest} (running {AGENT_VERSION})")
                    self_update(device_id, latest)

            heartbeat(device_id)

            # Resolve the effective blocked set for THIS device using policy
            # inheritance (device > location > org > global default).
            ctx = get_device_context(device_id)

            # Portal-issued commands (restart/update/uninstall). May re-exec or
            # terminate the process, so handle it before enforcement.
            if ctx.get("pending_command"):
                handle_command(device_id, ctx.get("pending_command"))

            # App operations queued from the portal (e.g. remote uninstall).
            process_app_commands(device_id)

            owner_id = ctx.get("user_id")
            all_apps = get_all_apps()
            policies = get_policies([ctx.get("org_id"), ctx.get("location_id"), device_id])
            effective_blocked = resolve_effective_blocked(all_apps, policies, ctx, device_id)

            # Per-user temporary access: if this device has been claimed by a
            # user, don't kill apps that user has an active approved grant for.
            granted_ids = get_granted_app_ids(owner_id)
            granted_apps = [a for a in effective_blocked if a.get("id") in granted_ids]
            blocked_apps = [a for a in effective_blocked if a.get("id") not in granted_ids]

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
                        # Tell the user why it closed — throttled per app so a
                        # relaunch loop doesn't spam banners.
                        now_n = time.time()
                        if now_n - last_notify.get(app["id"], 0) >= NOTIFY_INTERVAL:
                            notify_user("App Controller", f"{app['name']} is blocked by your administrator and has been closed.")
                            last_notify[app["id"]] = now_n

            # Full cycle succeeded — clear any network-failure streak.
            consecutive_net_fails = 0

        except requests.exceptions.RequestException as e:
            # Transient connectivity blip (timeout / reset / DNS). A single failed
            # poll is normal and self-heals next cycle, so it is NOT logged as an
            # event — only a sustained outage (NET_FAIL_ESCALATE consecutive
            # failures) is worth an operator's attention. Blips still print to the
            # local log for on-device debugging.
            consecutive_net_fails += 1
            msg = str(e)
            print(f"[agent] Network issue ({consecutive_net_fails} in a row): {msg}")
            now_err = time.time()
            if consecutive_net_fails >= NET_FAIL_ESCALATE and (msg != last_error["msg"] or now_err - last_error["ts"] >= 300):
                log_event(device_id, "error", "error",
                          f"Portal unreachable for {consecutive_net_fails} consecutive checks: {msg}")
                last_error = {"msg": msg, "ts": now_err}

        except Exception as e:
            # Genuine (non-network) fault — surface immediately at error severity.
            consecutive_net_fails = 0
            print(f"[agent] Error during check: {e}")
            # Throttle: only record a new error event when the message changes
            # or 5 minutes have passed, so a persistent failure can't spam the log.
            msg = str(e)
            now_err = time.time()
            if msg != last_error["msg"] or now_err - last_error["ts"] >= 300:
                log_event(device_id, "error", "error", f"Check failed: {msg}")
                last_error = {"msg": msg, "ts": now_err}

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
