#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Install scope:"
echo "  1) Workspace (.agents/plugins/alexandria-capture, relative to the current directory)"
echo "  2) Global (~/.gemini/config/plugins/alexandria-capture)"
read -p "Choose 1 or 2: " SCOPE

if [ "$SCOPE" = "1" ]; then
  DEST="$(pwd)/.agents/plugins/alexandria-capture"
elif [ "$SCOPE" = "2" ]; then
  DEST="$HOME/.gemini/config/plugins/alexandria-capture"
else
  echo "Invalid choice" >&2
  exit 1
fi

mkdir -p "$DEST"
cp -r "$SCRIPT_DIR"/. "$DEST"/
rm -f "$DEST/install.sh"

sed -i.bak "s|/REPLACE/WITH/ABSOLUTE/PATH|${DEST}|g" "$DEST/hooks.json"
rm -f "$DEST/hooks.json.bak"

echo "Installed to $DEST"
echo "Restart Antigravity (or reload plugins) to pick it up."
