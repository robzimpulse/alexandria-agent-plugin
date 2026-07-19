#!/usr/bin/env bash
set -euo pipefail

OPENCODE_PLUGIN_FILE="$HOME/.config/opencode/plugins/alexandria-capture.js"

if [ ! -f "$OPENCODE_PLUGIN_FILE" ]; then
  echo "No Alexandria Capture plugin found at $OPENCODE_PLUGIN_FILE — nothing to do."
  exit 0
fi

rm "$OPENCODE_PLUGIN_FILE"
echo "Removed $OPENCODE_PLUGIN_FILE"
echo "Restart OpenCode desktop app for the change to take effect."
