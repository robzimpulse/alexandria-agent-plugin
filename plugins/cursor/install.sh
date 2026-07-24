#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Installing Alexandria Capture for Cursor..."
echo ""

# Install hook binary
CURSOR_PLUGINS_DIR="$HOME/.cursor/plugins"
mkdir -p "$CURSOR_PLUGINS_DIR/alexandria-capture"
cp -r "$SCRIPT_DIR"/. "$CURSOR_PLUGINS_DIR/alexandria-capture/"
rm -f "$CURSOR_PLUGINS_DIR/alexandria-capture/install.sh"

# Write MCP config
MCP_CONFIG="$HOME/.cursor/mcp.json"
TMP=$(mktemp)
if [ -f "$MCP_CONFIG" ]; then
  cat "$MCP_CONFIG" > "$TMP"
else
  echo '{"mcpServers":{}}' > "$TMP"
fi

# Use node to merge MCP config safely
node -e "
const cfg = require('$TMP');
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers['alexandria'] = {
  command: 'node',
  args: ['${CURSOR_PLUGINS_DIR}/alexandria-capture/dist/cli.cjs', 'mcp']
};
require('fs').writeFileSync('$TMP', JSON.stringify(cfg, null, 2) + '\n');
"

mv "$TMP" "$MCP_CONFIG"

echo "Installed to $CURSOR_PLUGINS_DIR/alexandria-capture"
echo "MCP config written to $MCP_CONFIG"
echo ""
echo "Next steps:"
echo "  1. Restart Cursor to pick up the plugin"
echo "  2. Verify: check ~/.alexandria/plugin.log for events"
echo "  3. Configure Alexandria URL via ALEXANDRIA_URL env var or ~/.alexandria/config.json"