# Alexandria Capture — Claude Code plugin

Sends Claude Code hook events (`PostToolUse`, `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd`) to an Alexandria server for cross-session memory capture. Purely observational — it never blocks a tool call or alters Claude Code's behavior, and it fails silently if Alexandria is unreachable.

## Prerequisites

An Alexandria server URL. Optionally, an API key if the server runs in `api-key` mode.

Configure either via `~/.alexandria/config.json`:

```json
{ "url": "https://your-alexandria-server.example.com", "apiKey": "optional-key" }
```

or via environment variables `ALEXANDRIA_URL` / `ALEXANDRIA_API_KEY` — these override the config file.

## Install

### Via marketplace

```
/plugin marketplace add <path-or-url-to-this-repo>
/plugin install alexandria-capture@alexandria-agent-plugin
```

### For local testing (no marketplace needed)

```
claude --plugin-dir ./plugins/claude-code
```

After installing, run `/reload-plugins` if you change anything and want it picked up without restarting.

## What it does

Registers a hook command for 5 events under `hooks/hooks.json`, all pointing at the same bundled `dist/cli.cjs`. Each invocation reads the event JSON from stdin, forwards a normalized version to Alexandria, and always exits 0 with `{}` on stdout — regardless of whether the Alexandria call succeeded, so a slow or unreachable server never delays or interrupts your session. Failures are logged to `~/.alexandria/plugin.log`, never surfaced as an error in Claude Code itself.
