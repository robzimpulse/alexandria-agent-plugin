# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                    # Run all unit tests (vitest)
npm run typecheck           # TypeScript type-check, no emit
npm run build               # tsc, compiles src/ to dist/ (local dev only)
npm run package:plugins     # esbuild bundles each adapter -> plugins/<platform>/dist/{cli.cjs,mcp.cjs}
```

- Tests use `vitest` with `vi.mock` for dependency injection (client, config). Write tests alongside core modules and adapters.
- Run a single test file: `npx vitest run test/core/runner.test.ts`
- Run a single test: `npx vitest run test/core/runner.test.ts -t "runs the hook"`

## Architecture

**Purpose**: Capture hook events (tool calls, session lifecycle) from multiple AI coding agents and forward them to an Alexandria server for cross-session memory. Each platform gets its own adapter that translates the platform's native hook payload into a shared schema.

### Data flow

```
Platform hook event → JSON on stdin → adapter/translate.ts → CanonicalHookEvent → POST /api/hooks
                                                          ↘  ContextStore.refresh() → inject context into agent
```

For MCP tool access (Alexandria server's tools exposed to the host agent):
```
stdin (JSON-RPC frames) → mcp-relay.ts → proxy to Alexandria server /api/mcp → stdout (JSON-RPC frames)
```

### src/ layout

| Path | Role |
|---|---|
| `src/core/schema.ts` | `CanonicalHookEvent` + `EventData` types — the universal event format |
| `src/core/runner.ts` | `runStdioHook()` reads stdin, calls adapter `translate()`, sends event, optionally fetches context via `ContextStore`, writes platform-specific stdout |
| `src/core/client.ts` | `sendEvent()` POSTs to Alexandria server, logs to `~/.alexandria/plugin.log` |
| `src/core/config.ts` | Loads server URL + API key from `~/.alexandria/config.json` or env vars `ALEXANDRIA_URL`/`ALEXANDRIA_API_KEY` |
| `src/core/context-store.ts` | `ContextStore` class — fetches incremental observations from server per session, caches, renders `<alexandria-context>` markdown |
| `src/core/mcp-relay.ts` | `runMcpRelay()` — proxies MCP JSON-RPC (initialize, tools/list, tools/call, ping) to Alexandria server |
| `src/core/transcript-reader.ts` | Reads JSONL transcripts, detects platform, extracts user messages |
| `src/adapters/shared/buildEventData.ts` | Helper to build `EventData` with null defaults |
| `src/adapters/<platform>/translate.ts` | Native payload → `CanonicalHookEvent` |
| `src/adapters/<platform>/cli.ts` | Entry point: instantiates `ContextStore`, calls `runStdioHook(translate, ...)` |
| `src/adapters/<platform>/mcp.ts` | Entry point: calls `runMcpRelay(loadConfig())` |

### Supported platforms

| Platform | Plugin dir | Hook events | Context injection mechanism | Notes |
|---|---|---|---|---|
| Claude Code | `plugins/claude-code/` | SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd | `hookSpecificOutput.additionalContext` | Bundled MCP relay via `.mcp.json` |
| Codex | `plugins/codex/` | Same as claude-code | Same | Requires one-time `/hooks` trust |
| Cursor | `plugins/cursor/` | UserPromptSubmit, PostToolUse | Same | Uses `conversation_id`, workspace-based |
| Hermes | `plugins/hermes/` | on_session_start, pre_llm_call, post_tool_call, post_llm_call, on_session_end | `context` field in JSON output | Native names mapped to canonical via lookup table |
| Antigravity | `plugins/antigravity/` | PreToolUse, PostToolUse, UserPromptSubmit/SessionStart, Stop | PreToolUse: MCP `context_inject` via fetch; UserPromptSubmit: `injectSteps.ephemeralMessage` | Separate entry modes (pre, post, preinvocation, stop) |
| OpenCode | `src/adapters/opencode/plugin.ts` | session.created, message.updated, tool.execute.after, session.idle/deleted | N/A (no stdio hooks) | Native tool registration via `tool()` + event handlers |

### Packaging

`scripts/package-plugins.mjs` uses esbuild to bundle each adapter's `cli.ts` + `mcp.ts` into a standalone CJS blob under `plugins/<platform>/dist/`. The MCP relay config JSON (`.mcp.json`, `mcp_config.json`) is generated inline, not from template files. Plugin manifests get their `version` injected from `package.json`.

### Fail-silent principle

The runner catches all errors from translate/sendEvent/logging. A malformed payload, unreachable server, or bad translate must never produce a nonzero exit, missing stdout, or stderr noise — the host platform's hook system would interpret that as the hook failing.

### Platform plugin documentation

- [Claude Code plugins](https://code.claude.com/docs/en/plugins)
- [Codex plugins (OpenAI)](https://developers.openai.com/plugins/build/plugins)
- [Cursor plugins](https://cursor.com/docs/plugins)
- [Hermes plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins)
- [Antigravity plugins](https://antigravity.google/docs/plugins)
- [OpenCode plugins](https://opencode.ai/docs/plugins/#basic-structure)

### Configuration

The Alexandria server URL and optional API key are read from `~/.alexandria/config.json`:
```json
{ "url": "http://localhost:8080", "apiKey": "sk-..." }
```
Overridable via `ALEXANDRIA_URL` and `ALEXANDRIA_API_KEY` env vars.
