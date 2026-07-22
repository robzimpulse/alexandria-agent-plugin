#!/usr/bin/env bash
set -euo pipefail

CONFIG="$HOME/.hermes/config.yaml"
MARKER="# alexandria-capture"
PLUGIN_DIR="$HOME/.hermes/plugins/alexandria-hooks"
PLUGIN_NAME="alexandria-hooks"

# ---------------------------------------------------------------------------
# Phase 1: remove hook entries from config.yaml
# ---------------------------------------------------------------------------
HOOK_FOUND=false
if [ -f "$CONFIG" ] && grep -qF "$MARKER" "$CONFIG"; then
  HOOK_FOUND=true
  cp "$CONFIG" "$CONFIG.bak" 2>/dev/null || true
  echo "Backup saved to $CONFIG.bak"

python3 - "$MARKER" "$CONFIG" << 'PYEOF'
import sys
from pathlib import Path

marker = sys.argv[1]
config_path = sys.argv[2]

config_file = Path(config_path)
lines = config_file.read_text().splitlines(keepends=True)

filtered = []
removed = 0
skip_next = 0

for i, line in enumerate(lines):
    if skip_next > 0:
        skip_next -= 1
        removed += 1
        continue
    if marker in line:
        removed += 1
        skip_next = 1  # skip next line (the timeout: 5 line)
        continue
    filtered.append(line)

config_file.write_text("".join(filtered))
print(f"Removed {removed} line(s) -- Alexandria Capture entries removed from {config_path}")
PYEOF
fi

# ---------------------------------------------------------------------------
# Phase 2: remove the alexandria-hooks Python plugin
# ---------------------------------------------------------------------------
if [ -d "$PLUGIN_DIR" ]; then
  rm -rf "$PLUGIN_DIR"
  echo "Removed plugin directory: $PLUGIN_DIR"
else
  echo "Plugin directory not found: $PLUGIN_DIR"
fi

# ---------------------------------------------------------------------------
# Phase 3: remove alexandria-hooks from plugins.enabled in config.yaml
# ---------------------------------------------------------------------------
if [ -f "$CONFIG" ]; then
python3 - "$CONFIG" "$PLUGIN_NAME" << 'PYEOF'
import sys
from pathlib import Path

config_path = sys.argv[1]
plugin_name = sys.argv[2]

config_file = Path(config_path)
lines = config_file.read_text().splitlines(keepends=True)

filtered = []
removed = 0
skip_next = 0

for i, line in enumerate(lines):
    if skip_next > 0:
        skip_next -= 1
        removed += 1
        continue
    if plugin_name in line:
        removed += 1
        continue
    filtered.append(line)

config_file.write_text("".join(filtered))
if removed:
    print(f"Removed {removed} line(s) referencing '{plugin_name}' from {config_path}")
else:
    print(f"No references to '{plugin_name}' found in {config_path}")
PYEOF
fi

echo ""
echo "Alexandria Capture uninstalled from Hermes."
