#!/usr/bin/env bash
set -euo pipefail

CONFIG="$HOME/.hermes/config.yaml"
MARKER="# alexandria-capture"

if [ ! -f "$CONFIG" ] || ! grep -qF "$MARKER" "$CONFIG"; then
  echo "No Alexandria Capture hooks found in $CONFIG — nothing to do."
  echo "(If you added the hooks manually without the marker comment, remove them by hand.)"
  exit 0
fi

cp "$CONFIG" "$CONFIG.bak" 2>/dev/null || true
echo "Backup saved to $CONFIG.bak"

# Remove lines containing the marker, and the timeout line following each
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
        # Remove this line and the next (timeout) line
        removed += 1
        skip_next = 1  # skip next line (the timeout: 5 line)
        continue
    filtered.append(line)

config_file.write_text("".join(filtered))
print(f"Removed {removed} line(s) — Alexandria Capture entries removed from {config_path}")
PYEOF
