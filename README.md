# alexandria-agent-plugin

Plugins that capture coding-agent hook events (tool calls, session lifecycle) from multiple AI coding agents and forward them to an Alexandria server for cross-session memory. Each agent platform gets its own adapter, translating that platform's native hook payload into one shared event shape.

## Status

| Platform | Status |
|---|---|
| Claude Code | Implemented, packaged in `plugins/claude-code/` |
| Codex | Implemented, packaged in `plugins/codex/` |
| Antigravity | Not yet implemented |
| Hermes | Not yet implemented |
| Opencode | Not yet implemented |

## Structure

```
src/
  core/           Shared schema, HTTP client, config loader, stdio runner
  adapters/
    claude-code/    translate() + cli.ts + manifest source, per platform
    codex/
test/
  core/           Unit tests for the shared core
  adapters/       Unit tests for each adapter's translate()
  fixtures/       Sample hook payloads used by the adapter tests
plugins/
  claude-code/    Installable Claude Code plugin (self-contained bundle + manifest)
  codex/            Installable Codex plugin (self-contained bundle + manifest)
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

See [`plugins/claude-code/README.md`](plugins/claude-code/README.md) or [`plugins/codex/README.md`](plugins/codex/README.md) for platform-specific install instructions.
