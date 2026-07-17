#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

read -p "Remove $SCRIPT_DIR ? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

echo "Removing $SCRIPT_DIR ..."
echo "Restart Antigravity (or reload plugins) to fully unregister the hooks."
rm -rf "$SCRIPT_DIR"
