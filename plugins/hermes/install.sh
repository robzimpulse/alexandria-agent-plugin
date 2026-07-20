#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/dist/cli.cjs"
CONFIG="$HOME/.hermes/config.yaml"
MARKER="# alexandria-capture"

# Canonical-mapped Hermes events only (no post_api_request, no pre_tool_call)
EVENTS=("post_tool_call" "on_session_start" "on_session_reset" "pre_llm_call" "on_session_end")

if grep -qF "$MARKER" "$CONFIG" 2>/dev/null; then
  echo "Already installed in $CONFIG — nothing to do."
  exit 0
fi

mkdir -p "$(dirname "$CONFIG")"
cp "$CONFIG" "$CONFIG.bak" 2>/dev/null || true
echo "Backup saved to $CONFIG.bak"

python3 - "$CLI_PATH" "$CONFIG" "$MARKER" "${EVENTS[@]}" << 'PYEOF'
import sys, re
from pathlib import Path

cli_path = sys.argv[1]
config_path = sys.argv[2]
marker = sys.argv[3]
events = sys.argv[4:]

config_file = Path(config_path)
text = config_file.read_text() if config_file.exists() else ""
lines = text.splitlines(keepends=True)

# Locate the hooks: block
hooks_line = next((i for i, l in enumerate(lines) if l.strip() == 'hooks:'), None)

def find_hook_end(start):
    """Return index of first line after the hooks block."""
    for i in range(start + 1, len(lines)):
        l = lines[i]
        if l.strip() and not l[0].isspace() and not l.strip().startswith('#'):
            return i
    return len(lines)

if hooks_line is None:
    out = text
    if out and not out.endswith('\n'):
        out += '\n'
    out += "hooks:\n"
    for ev in events:
        out += f"  {ev}:\n"
        out += f'    - command: "{cli_path}"  {marker}\n'
        out += f"      timeout: 5\n"
    config_file.write_text(out)
    print("Created hooks block with Alexandria Capture entries.")
    sys.exit(0)

hook_end = find_hook_end(hooks_line)
added = 0

for ev in events:
    # Find the event key line
    ev_line = None
    for i in range(hooks_line + 1, hook_end):
        if lines[i].strip().startswith(ev + ':'):
            ev_line = i
            break

    if ev_line is None:
        # Event key doesn't exist — add new block before hook_end
        lines.insert(hook_end, f"  {ev}:\n")
        lines.insert(hook_end, f'    - command: "{cli_path}"  {marker}\n')
        lines.insert(hook_end, f"      timeout: 5\n")
        hook_end += 3
        added += 1
        continue

    # Find the end of this event's block (next event key — 2-space indent, not 4+)
    ev_end = hook_end
    for j in range(ev_line + 1, hook_end):
        if re.match(r'^  [a-z_]', lines[j]) and ':' in lines[j]:
            ev_end = j
            break

    # Check if we already have an entry with our marker
    has_marker = any(marker in lines[j] for j in range(ev_line + 1, ev_end))
    if has_marker:
        continue

    # Find the last line with content in this event's block
    ins_point = ev_end
    for j in range(ev_end - 1, ev_line, -1):
        if lines[j].strip():
            ins_point = j + 1
            break

    lines.insert(ins_point, f"      timeout: 5\n")
    lines.insert(ins_point, f'    - command: "{cli_path}"  {marker}\n')
    hook_end += 2
    added += 1

config_file.write_text("".join(lines))
print(f"Added {added} Alexandria Capture hook entries to {config_path}")
PYEOF
