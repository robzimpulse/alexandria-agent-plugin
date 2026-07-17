#!/usr/bin/env bash
set -euo pipefail

CONFIG="$HOME/.hermes/config.yaml"
START_MARKER="# --- alexandria-capture (managed by plugins/hermes/install.sh) ---"
END_MARKER="# --- end alexandria-capture ---"

if [ ! -f "$CONFIG" ] || ! grep -qF "$START_MARKER" "$CONFIG"; then
  echo "No managed Alexandria Capture block found in $CONFIG — nothing to do."
  echo "(If you added the hooks manually instead of via install.sh, remove them by hand.)"
  exit 0
fi

cp "$CONFIG" "$CONFIG.bak"
awk -v start="$START_MARKER" -v end="$END_MARKER" '
  $0 == start { skip=1; next }
  $0 == end { skip=0; next }
  skip == 0 { print }
' "$CONFIG" > "$CONFIG.new"
mv "$CONFIG.new" "$CONFIG"

echo "Removed Alexandria Capture hooks from $CONFIG (backup saved to $CONFIG.bak)."
