#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/dist/cli.cjs"
CONFIG="$HOME/.hermes/config.yaml"
START_MARKER="# --- alexandria-capture (managed by plugins/hermes/install.sh) ---"
END_MARKER="# --- end alexandria-capture ---"

SNIPPET=$(cat <<EOF
$START_MARKER
hooks:
  post_tool_call:
    - command: "$CLI_PATH"
      timeout: 5
  on_session_start:
    - command: "$CLI_PATH"
      timeout: 5
  pre_llm_call:
    - command: "$CLI_PATH"
      timeout: 5
  post_llm_call:
    - command: "$CLI_PATH"
      timeout: 5
  on_session_end:
    - command: "$CLI_PATH"
      timeout: 5
$END_MARKER
EOF
)

mkdir -p "$(dirname "$CONFIG")"
touch "$CONFIG"

if grep -qF "$START_MARKER" "$CONFIG"; then
  echo "Already installed in $CONFIG — nothing to do."
  exit 0
fi

if grep -qE '^hooks:' "$CONFIG"; then
  echo "WARNING: $CONFIG already has a top-level 'hooks:' key."
  echo "Automatic merging isn't safe here — add this snippet's entries under your existing hooks: block by hand:"
  echo ""
  echo "$SNIPPET"
  exit 1
fi

cp "$CONFIG" "$CONFIG.bak"
printf "\n%s\n" "$SNIPPET" >> "$CONFIG"
echo "Added Alexandria Capture hooks to $CONFIG (backup saved to $CONFIG.bak)."
echo "First run of each hook will prompt for approval — see plugins/hermes/README.md."
