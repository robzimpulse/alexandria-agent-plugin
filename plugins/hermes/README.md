# Alexandria Capture — Hermes plugin

Sends Hermes hook events (`post_tool_call`, `on_session_start`, `pre_llm_call`, `post_llm_call`, `on_session_end`) to an Alexandria server for cross-session memory capture. Purely observational — it never blocks a tool call or alters Hermes' behavior, and it fails silently if Alexandria is unreachable.

## Prerequisites

Same as every other Alexandria plugin: an Alexandria server URL, optionally an API key, via `~/.alexandria/config.json` or the `ALEXANDRIA_URL`/`ALEXANDRIA_API_KEY` environment variables.

## Install

Unlike Claude Code and Codex, Hermes has no plugin manifest or marketplace mechanism for shell hooks — installing means merging a snippet into your own `~/.hermes/config.yaml`. Run:

```
./install.sh
```

This does the following:

1. **Config hooks** — merges a `hooks:` block (5 events, all pointing at `dist/cli.cjs`) into `~/.hermes/config.yaml`, wrapped in marker comments so re-running is idempotent. Backs up `config.yaml.bak` first.
2. **Allowlist** — pre-approves each hook event in `~/.hermes/shell-hooks-allowlist.json` so you aren't prompted at first use.
3. **Bootstrapper plugin** — installs a Python plugin at `~/.hermes/plugins/alexandria-hooks/`. This is required because Hermes' `cmd_dashboard` / `hermes serve` entrypoint (the desktop app backend) never calls `register_from_config()` for shell hooks — only CLI and gateway paths do. The plugin forces hook registration at plugin-discovery time, which both desktop and CLI paths trigger.
4. **Plugin activation** — adds `alexandria-hooks` to `plugins.enabled` in `config.yaml` (user plugins are opt-in in Hermes).

To remove it: `./uninstall.sh`. This reverses all four steps.

## What it Does

Each invocation reads the event JSON from stdin, forwards a normalized version to Alexandria, and always exits 0 with empty/no meaningful output — regardless of whether the Alexandria call succeeded. Failures are logged to `~/.alexandria/plugin.log`, never surfaced as an error in Hermes itself.
