#!/bin/bash
# Build Ravyn.app (macOS companion) locally — no Xcode project needed.
# Compiles main.swift, assembles the .app bundle with the Ravyn icon, and
# ad-hoc signs it for local testing. Run on macOS:  bash build.sh
set -euo pipefail

cd "$(dirname "$0")"
APP="Ravyn.app"
ICON_SRC="AppIcon.png"   # transparent glossy diamond (no tile) — used for the
                         # Finder icon and, notably, the notification icon

echo "[build] Compiling…"
rm -rf build "$APP"
mkdir -p build
swiftc main.swift -o build/Ravyn -framework AppKit -framework UserNotifications

echo "[build] Assembling $APP…"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
mv build/Ravyn "$APP/Contents/MacOS/Ravyn"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Ravyn</string>
  <key>CFBundleDisplayName</key><string>Ravyn</string>
  <key>CFBundleIdentifier</key><string>app.ravyn.companion</string>
  <key>CFBundleExecutable</key><string>Ravyn</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
PLIST

echo "[build] Generating icon…"
if [ -f "$ICON_SRC" ]; then
  ICONSET="build/AppIcon.iconset"; mkdir -p "$ICONSET"
  for SZ in 16 32 128 256 512; do
    sips -z $SZ $SZ "$ICON_SRC" --out "$ICONSET/icon_${SZ}x${SZ}.png" >/dev/null
    D=$((SZ*2)); sips -z $D $D "$ICON_SRC" --out "$ICONSET/icon_${SZ}x${SZ}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
else
  echo "[build] WARN: $ICON_SRC not found — app will use a default icon."
fi

# Menu-bar icon — transparent purple diamond (no tile), separate from the tiled
# AppIcon used for notifications/Finder.
[ -f MenuBarIcon.png ] && cp MenuBarIcon.png "$APP/Contents/Resources/MenuBarIcon.png"

echo "[build] Ad-hoc signing…"
codesign --force --deep --sign - "$APP"

echo "[build] Done → $(pwd)/$APP"
echo "[build] Run it:  open $APP    (or: ./$APP/Contents/MacOS/Ravyn for logs)"
