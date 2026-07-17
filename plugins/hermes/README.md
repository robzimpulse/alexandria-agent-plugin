# Alexandria Capture — Hermes plugin

Sends Hermes hook events (`post_tool_call`, `on_session_start`, `pre_llm_call`, `post_llm_call`, `on_session_end`) to an Alexandria server for cross-session memory capture. Purely observational — it never blocks a tool call or alters Hermes' behavior, and it fails silently if Alexandria is unreachable.

## Prerequisites

Same as every other Alexandria plugin: an Alexandria server URL, optionally an API key, via `~/.alexandria/config.json` or the `ALEXANDRIA_URL`/`ALEXANDRIA_API_KEY` environment variables.

## Install

Unlike Claude Code and Codex, Hermes has no plugin manifest or marketplace mechanism for shell hooks — installing means merging a snippet into your own `~/.hermes/config.yaml`. Run:

```
./install.sh
```

This computes the real path to `dist/cli.cjs` and merges a `hooks:` block (5 events, all pointing at that path — no `node` prefix needed, the file has a `#!/usr/bin/env node` shebang and is already executable) into `~/.hermes/config.yaml`, wrapped in marker comments so re-running the script is a safe no-op and the file is backed up first (`config.yaml.bak`). If your `config.yaml` already has a top-level `hooks:` key, the script won't touch the file — it prints the snippet instead, since blind text-appending into an existing `hooks:` block isn't safe. In that case, add the printed entries under your existing `hooks:` key by hand.

To remove it: `./uninstall.sh`. This deletes exactly the block `install.sh` added (again backing up first) and leaves everything else in `config.yaml` untouched.

### Approval (required, one-time per event)

Hermes prompts for approval the first time it sees each `(event, command)` pair, then remembers the decision in `~/.hermes/shell-hooks-allowlist.json`. For non-interactive installs (gateway, cron, CI) where you can't answer the prompt, use one of:

- `--accept-hooks` CLI flag
- `HERMES_ACCEPT_HOOKS=1` environment variable
- `hooks_auto_accept: true` in `config.yaml`

## What it does

Each invocation reads the event JSON from stdin, forwards a normalized version to Alexandria, and always exits 0 with empty/no meaningful output — regardless of whether the Alexandria call succeeded. Failures are logged to `~/.alexandria/plugin.log`, never surfaced as an error in Hermes itself.
