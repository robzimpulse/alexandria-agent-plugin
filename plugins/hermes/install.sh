#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/dist/cli.cjs"
CONFIG="$HOME/.hermes/config.yaml"
MARKER="# alexandria-capture"
PLUGIN_DIR="$HOME/.hermes/plugins/alexandria-hooks"

# Canonical-mapped Hermes events only (no post_api_request, no pre_tool_call)
EVENTS=("post_tool_call" "on_session_start" "on_session_reset" "pre_llm_call" "on_session_end")

# ---------------------------------------------------------------------------
# Phase 1: write hooks block into config.yaml (idempotent)
# ---------------------------------------------------------------------------
if grep -qF "$MARKER" "$CONFIG" 2>/dev/null; then
  echo "Already installed in $CONFIG — hooks block skipped."
else
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
fi

# ---------------------------------------------------------------------------
# Phase 2: pre-approve hooks in the Hermes shell-hook allowlist
# Runs unconditionally (even if hooks already in config).
# ---------------------------------------------------------------------------
python3 - "$CLI_PATH" "${EVENTS[@]}" << 'PYEOF'
import json, os, sys
from datetime import datetime, timezone

cli_path = os.path.normpath(sys.argv[1])
events = sys.argv[2:]

def script_mtime_iso(path: str) -> str:
    """Read mtime as ISO string, matching shell_hooks.py format."""
    try:
        st = os.stat(path)
        return datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    except OSError:
        return ""

allowlist_dir = os.path.expanduser("~/.hermes")
allowlist_path = os.path.join(allowlist_dir, "shell-hooks-allowlist.json")

# Read existing allowlist or start fresh
allowlist = {"approvals": []}
try:
    with open(allowlist_path, "r") as f:
        allowlist = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass
if not isinstance(allowlist.get("approvals"), list):
    allowlist["approvals"] = []

mtime = script_mtime_iso(cli_path)
existing_commands = {e.get("command") for e in allowlist["approvals"] if isinstance(e, dict)}

for ev in events:
    if cli_path not in existing_commands:
        allowlist["approvals"].append({
            "event": ev,
            "command": cli_path,
            "approved_at": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
            "script_mtime_at_approval": mtime,
        })

os.makedirs(allowlist_dir, exist_ok=True)
with open(allowlist_path, "w") as f:
    json.dump(allowlist, f, indent=2, sort_keys=True)

n_added = len(allowlist["approvals"]) - len(existing_commands)
print(f"Approved {n_added} hook command path(s) in {allowlist_path}")
PYEOF

# ---------------------------------------------------------------------------
# Phase 3: install Python plugin that bootstraps hook registration for
# the dashboard/serve entrypoint (desktop app backend).  Hermes'
# _prepare_agent_startup() only runs for CLI/gateway commands; the
# dashboard path calls discover_plugins(), so a plugin loaded there
# can wire shell hooks on its behalf.
# ---------------------------------------------------------------------------
mkdir -p "$PLUGIN_DIR"

cat > "$PLUGIN_DIR/plugin.yaml" << 'PLUGIN_YAML'
name: alexandria-hooks
version: 1.0.0
description: "Bootstraps Alexandria shell-hook registration for Hermes dashboard/serve (desktop app)."
PLUGIN_YAML

cat > "$PLUGIN_DIR/__init__.py" << 'PLUGIN_PY'
"""Bootstrap shell-hook registration for the dashboard/serve entrypoint.

Hermes' _prepare_agent_startup() only runs for _AGENT_COMMANDS
({None, "chat", "acp", "rl"}), so shell hooks are never registered
when running under `hermes serve` / `hermes dashboard` -- the desktop
app's backend.  This plugin forces registration at plugin-discovery
time, which both the CLI and dashboard paths trigger.

Fails silently: a broken or missing shell-hook script doesn't block
dashboard startup, and the debug log is the only signal.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

def register(ctx) -> None:
    try:
        from hermes_cli.config import load_config
        from agent.shell_hooks import register_from_config

        cfg = load_config()
        registered = register_from_config(cfg, accept_hooks=False)
        if registered:
            logger.info(
                "alexandria-hooks: registered %d shell hook(s)",
                len(registered),
            )
        else:
            logger.debug(
                "alexandria-hooks: no shell hooks to register "
                "(no hooks block in config, or all already registered)"
            )
    except Exception:
        logger.debug(
            "alexandria-hooks: shell-hook registration failed",
            exc_info=True,
        )
PLUGIN_PY

echo "Plugin written to $PLUGIN_DIR"

# ---------------------------------------------------------------------------
# Phase 4: ensure the plugin is in config.yaml's plugins.enabled list.
# User plugins are opt-in in Hermes -- without this the plugin is
# discovered but never loaded.
# ---------------------------------------------------------------------------
python3 - "$CONFIG" "$MARKER" << 'PYEOF'
import sys
from pathlib import Path

config_path = sys.argv[1]
_marker = sys.argv[2]
PLUGIN_NAME = "alexandria-hooks"
SECTION_MARKER = "# alexandria-capture"

config_file = Path(config_path)
text = config_file.read_text() if config_file.exists() else ""
lines = text.splitlines(keepends=True)

# 1. Check if plugins.enabled already contains our plugin name.
#    Look for a `plugins:` block first, then `plugins.enabled:` or
#    `  enabled:` right under it.  Since this is YAML, there are
#    many shapes; instead of full parsing we append a fresh block
#    at the end and rely on YAML merge semantics.
has_entry = any(PLUGIN_NAME in l for l in lines)
if has_entry:
    print(f"{PLUGIN_NAME} already in config -- no change")
    sys.exit(0)

# 2. Find where the `plugins:` key is (top-level, first column, no indent).
plugins_line = next((i for i, l in enumerate(lines) if l.strip() == 'plugins:'), None)

if plugins_line is None:
    # No plugins block at all -- append one before the last non-blank line.
    # Find the last top-level key to insert before it, or just append.
    for i in range(len(lines) - 1, 0, -1):
        stripped = lines[i].strip()
        if stripped and not stripped.startswith('#'):
            # Skip indented lines -- find the last top-level key
            if not lines[i][0].isspace():
                # Insert after this key's block... simpler: just append.
                break
    # Append at the end (before trailing newlines)
    out = text.rstrip('\n') + '\n'
    out += "plugins:\n"
    out += "  enabled:\n"
    out += f"    - {PLUGIN_NAME}  {SECTION_MARKER}\n"
else:
    # plugins block exists. Find `enabled:` under it (2-space indent).
    enabled_line = None
    for i in range(plugins_line + 1, len(lines)):
        l = lines[i]
        if l.strip().startswith('enabled:'):
            enabled_line = i
            break
        # Stop at the next top-level key
        if l.strip() and not l[0].isspace():
            break

    if enabled_line is None:
        # Insert `  enabled:\n    - <name>` after the last child of plugins:
        ins = plugins_line + 1
        for i in range(plugins_line + 1, len(lines)):
            l = lines[i]
            if l.strip() and not l[0].isspace():
                break
            if l.strip():
                ins = i + 1
        lines.insert(ins, f"    - {PLUGIN_NAME}  {SECTION_MARKER}\n")
        lines.insert(ins, f"  enabled:\n")
    else:
        # enabled line exists; check if the list already has our plugin
        has_plugin = False
        for i in range(enabled_line + 1, len(lines)):
            l = lines[i]
            if not l.strip() or l[0].isspace():
                if PLUGIN_NAME in l:
                    has_plugin = True
                    break
            else:
                break  # next top-level key
        if not has_plugin:
            lines.insert(enabled_line + 1, f"    - {PLUGIN_NAME}  {SECTION_MARKER}\n")
        else:
            print(f"{PLUGIN_NAME} already in plugins.enabled -- no change")
            sys.exit(0)

config_file.write_text("".join(lines))
print(f"Added {PLUGIN_NAME} to plugins.enabled in {config_path}")
PYEOF

echo ""
echo "Done.  Restart Hermes (Desktop app or CLI) for hooks to fire."
