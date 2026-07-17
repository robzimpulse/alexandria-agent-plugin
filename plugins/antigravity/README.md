# Alexandria Capture — Antigravity plugin

Sends Antigravity hook events (`PreToolUse`, `PostToolUse`, `PreInvocation` — reported as `SessionStart`/`UserPromptSubmit`, `Stop`) to an Alexandria server for cross-session memory capture. Purely observational — it never blocks a tool call or alters Antigravity's behavior, and it fails silently if Alexandria is unreachable.

## Prerequisites

Same as every other Alexandria plugin: an Alexandria server URL, optionally an API key, via `~/.alexandria/config.json` or the `ALEXANDRIA_URL`/`ALEXANDRIA_API_KEY` environment variables.

## Install

Antigravity has no marketplace — plugins are discovered by directory placement. Run:

```
./install.sh
```

You'll be asked to choose a scope:

- **Workspace** — copies this plugin to `.agents/plugins/alexandria-capture/` under your current directory. Active only in that workspace.
- **Global** — copies to `~/.gemini/config/plugins/alexandria-capture/`. Active across all workspaces.

The script copies the plugin and substitutes the placeholder path in `hooks.json` with the real destination path automatically — there's no manual editing step. Restart Antigravity (or reload plugins) afterward.

To remove it, run the `uninstall.sh` that was copied alongside it — e.g. `~/.gemini/config/plugins/alexandria-capture/uninstall.sh` for a global install.

## What it does

Each invocation reads the event JSON from stdin, forwards a normalized version to Alexandria, and always exits 0 with the output Antigravity expects for that event (`{"decision":"allow"}` for `PreToolUse`, `{}` for `PostToolUse`/`PreInvocation`, `{"decision":""}` for `Stop`) — regardless of whether the Alexandria call succeeded. Failures are logged to `~/.alexandria/plugin.log`, never surfaced as an error in Antigravity itself.

## Known limitation

`PostToolUse`'s tool name/arguments/result come from parsing Antigravity's internal `transcript.jsonl` conversation log, whose exact format isn't publicly documented. This adapter's parsing logic is built against a best-guess assumption and may need updating once a real transcript is observed from a live install.
