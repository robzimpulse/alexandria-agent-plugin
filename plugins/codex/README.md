# Alexandria Capture — Codex plugin

Sends Codex hook events (`PostToolUse`, `SessionStart`, `UserPromptSubmit`, `Stop`) to an Alexandria server for cross-session memory capture. Purely observational — it never blocks a tool call or alters Codex's behavior, and it fails silently if Alexandria is unreachable.

## Prerequisites

Same as the Claude Code plugin: an Alexandria server URL, optionally an API key, via `~/.alexandria/config.json` or the `ALEXANDRIA_URL`/`ALEXANDRIA_API_KEY` environment variables.

## Install

```
codex plugin marketplace add <path-or-url-to-this-repo>
```

Then enable the plugin from Codex's plugin manager.

### Trust step (required, one-time)

Codex requires you to explicitly review and trust a plugin's hook definitions before they'll actually fire. After installing:

```
/hooks
```

and trust `alexandria-capture`'s hook definitions. Codex tracks trust by hash, so editing the hook later re-triggers this review. For scripted or non-interactive installs where you can't answer the prompt, pass `--dangerously-bypass-hook-trust` instead.

## What it does

Registers a hook command for 4 events under `hooks/hooks.json`, all pointing at the same bundled `dist/cli.cjs`. Each invocation reads the event JSON from stdin, forwards a normalized version to Alexandria, and always exits 0 with empty output — regardless of whether the Alexandria call succeeded. Failures are logged to `~/.alexandria/plugin.log`, never surfaced as an error in Codex itself.
