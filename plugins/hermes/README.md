# Alexandria Capture — Hermes plugin

Sends Hermes hook events (`post_tool_call`, `on_session_start`, `pre_llm_call`, `post_llm_call`, `on_session_end`) to an Alexandria server for cross-session memory capture. Purely observational — it never blocks a tool call or alters Hermes' behavior, and it fails silently if Alexandria is unreachable.

## Prerequisites

Same as every other Alexandria plugin: an Alexandria server URL, optionally an API key, via `~/.alexandria/config.json` or the `ALEXANDRIA_URL`/`ALEXANDRIA_API_KEY` environment variables.

## Install

Unlike Claude Code and Codex, Hermes has no plugin manifest or marketplace mechanism for shell hooks — installing means pasting a snippet into your own `~/.hermes/config.yaml`, not running an install command.

Add this to `~/.hermes/config.yaml`, replacing the path with wherever this repo's `plugins/hermes/dist/cli.cjs` actually lives on your machine:

```yaml
hooks:
  post_tool_call:
    - command: "/absolute/path/to/plugins/hermes/dist/cli.cjs"
      timeout: 5
  on_session_start:
    - command: "/absolute/path/to/plugins/hermes/dist/cli.cjs"
      timeout: 5
  pre_llm_call:
    - command: "/absolute/path/to/plugins/hermes/dist/cli.cjs"
      timeout: 5
  post_llm_call:
    - command: "/absolute/path/to/plugins/hermes/dist/cli.cjs"
      timeout: 5
  on_session_end:
    - command: "/absolute/path/to/plugins/hermes/dist/cli.cjs"
      timeout: 5
```

No `node` prefix needed — the file has a `#!/usr/bin/env node` shebang and is already executable.

### Approval (required, one-time per event)

Hermes prompts for approval the first time it sees each `(event, command)` pair, then remembers the decision in `~/.hermes/shell-hooks-allowlist.json`. For non-interactive installs (gateway, cron, CI) where you can't answer the prompt, use one of:

- `--accept-hooks` CLI flag
- `HERMES_ACCEPT_HOOKS=1` environment variable
- `hooks_auto_accept: true` in `config.yaml`

## What it does

Each invocation reads the event JSON from stdin, forwards a normalized version to Alexandria, and always exits 0 with empty/no meaningful output — regardless of whether the Alexandria call succeeded. Failures are logged to `~/.alexandria/plugin.log`, never surfaced as an error in Hermes itself.
