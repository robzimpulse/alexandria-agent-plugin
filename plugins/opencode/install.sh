#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR/dist/plugin.js"
OPENCODE_PLUGIN_DIR="$HOME/.config/opencode/plugins"

mkdir -p "$OPENCODE_PLUGIN_DIR"

if [ -f "$OPENCODE_PLUGIN_DIR/alexandria-capture.js" ]; then
  echo "Already installed at $OPENCODE_PLUGIN_DIR/alexandria-capture.js — nothing to do."
  exit 0
fi

cp "$PLUGIN_SRC" "$OPENCODE_PLUGIN_DIR/alexandria-capture.js"
echo "Installed Alexandria Capture plugin to $OPENCODE_PLUGIN_DIR/alexandria-capture.js"
echo ""
echo "Next steps:"
echo "  1. Restart OpenCode desktop app"
echo "  2. Verify: check OpenCode logs for plugin initialization"
echo "  3. Configure Alexandria URL via ALEXANDRIA_URL env var (default: http://localhost/api/v1)"
echo "     or create ~/.alexandria/config.json with {\"url\": \"...\", \"apiKey\": \"...\"}"
