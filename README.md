# alexandria-agent-plugin

Plugins that capture coding-agent hook events (tool calls, session lifecycle) from multiple AI coding agents and forward them to an Alexandria server for cross-session memory. Each agent platform gets its own adapter, translating that platform's native hook payload into one shared event shape.

## Status

| Platform | Status |
|---|---|
| Claude Code | Implemented, packaged in `plugins/claude-code/` |
| Codex | Implemented, packaged in `plugins/codex/` |
| Antigravity | Implemented, packaged in `plugins/antigravity/` |
| Hermes | Implemented, packaged in `plugins/hermes/` |
| Opencode | Not yet implemented |

## Structure

```
src/
  core/           Shared schema, HTTP client, config loader, stdio runner
  adapters/
    claude-code/    translate() + cli.ts + manifest source, per platform
    codex/
    hermes/
    antigravity/
test/
  core/           Unit tests for the shared core
  adapters/       Unit tests for each adapter's translate()
  fixtures/       Sample hook payloads used by the adapter tests
plugins/
  claude-code/    Installable Claude Code plugin (self-contained bundle + manifest)
  codex/            Installable Codex plugin (self-contained bundle + manifest)
  hermes/            Installable Hermes plugin (self-contained, executable bundle — no manifest; install.sh/uninstall.sh manage config.yaml)
  antigravity/         Installable Antigravity plugin (flat manifest layout — no subdirectory; install.sh/uninstall.sh manage directory placement)
scripts/
  package-plugins.mjs   Bundles each adapter into its plugins/<platform>/ directory
```

## Scripts

```
npm test                 # run all unit tests (vitest)
npm run typecheck          # tsc, no emit
npm run build                 # tsc, compiles src/ to dist/ (local dev/testing, not distribution)
npm run package:plugins         # bundles each adapter into plugins/<platform>/dist/cli.cjs
```

## Installing a plugin

See [`plugins/claude-code/README.md`](plugins/claude-code/README.md), [`plugins/codex/README.md`](plugins/codex/README.md), [`plugins/hermes/README.md`](plugins/hermes/README.md), or [`plugins/antigravity/README.md`](plugins/antigravity/README.md) for platform-specific install instructions.
