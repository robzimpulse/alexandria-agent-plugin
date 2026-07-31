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

### The shared runner (`src/core/runner.ts`)

Every stdio adapter's `cli.ts` delegates to `runStdioHook(translate, stdout, io, { contextStore })`, which:

1. Reads + `JSON.parse`s stdin, calls the adapter's `translate(raw)` → `CanonicalHookEvent`.
2. **Overwrites the adapter's `project_name`** via `resolveProjectName()`: Hermes `~/.hermes/state.db` sqlite lookup by session_id → `git rev-parse --show-toplevel` from cwd → `basename(cwd)` → `"General"`.
3. `sendEvent()` → POST `/api/hooks`.
4. Context injection fires **only** for `UserPromptSubmit`/`PostToolUse` and only when a `ContextStore` is passed. Output format per platform (`formatHookOutput`):
   - claude-code / codex / cursor → `{ hookSpecificOutput: { hookEventName, additionalContext } }`
   - hermes → `{ context }`
   - antigravity → `{ injectSteps: [{ ephemeralMessage }] }` (UserPromptSubmit only; other events get `{}`)

On any error the default `stdout` is written and the process exits 0 (fail-silent, below).

### src/ layout

| Path | Role |
|---|---|
| `src/core/schema.ts` | `CanonicalHookEvent` + `EventData` types — the universal event format |
| `src/core/runner.ts` | `runStdioHook()` + `formatHookOutput()` — stdin → translate → send → context injection |
| `src/core/client.ts` | `sendEvent()` POSTs to `/api/hooks`; logs outcomes to `~/.alexandria/plugin.log` and a fuller record to `~/.alexandria/logs/<platform>.log` |
| `src/core/config.ts` | Loads server URL + API key from `~/.alexandria/config.json` or env vars `ALEXANDRIA_URL`/`ALEXANDRIA_API_KEY` (env wins) |
| `src/core/context-store.ts` | `ContextStore` — incremental per-session observation fetch (`/api/context-since`, cursor = `since_observation_id`), caches, renders `<alexandria-context>` markdown; logs to `~/.alexandria/context.log` |
| `src/core/mcp-relay.ts` | `runMcpRelay()` — JSON-RPC proxy; terminates `initialize`/`ping` locally, caches `tools/list` for 60s, forwards `tools/call` verbatim |
| `src/core/transcript-reader.ts` | Reads JSONL transcripts, detects platform, extracts user messages / tool-call steps |
| `src/adapters/shared/buildEventData.ts` | Helper to build `EventData` with null defaults |
| `src/adapters/<platform>/translate.ts` | Native payload → `CanonicalHookEvent` |
| `src/adapters/<platform>/cli.ts` | Entry point: instantiates `ContextStore`, calls `runStdioHook(translate, ...)` |
| `src/adapters/<platform>/mcp.ts` | Entry point: calls `runMcpRelay(loadConfig())` |

### Supported platforms

| Platform | Plugin dir | Hook events | Context injection mechanism | Notes |
|---|---|---|---|---|
| Claude Code | `plugins/claude-code/` | SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd | `hookSpecificOutput.additionalContext` | Bundled MCP relay via `.mcp.json` |
| Codex | `plugins/codex/` | Same as claude-code | Same | Requires one-time `/hooks` trust; edits to the hook definition re-trigger review — pass `--dangerously-bypass-hook-trust` for automated installs |
| Cursor | `plugins/cursor/` | UserPromptSubmit, PostToolUse | Same | Session id = `conversation_id`; `project_name` from `workspace_roots[0]`; PostToolUse's top-level `file_path`/`edits` synthesized into `tool_input`, response in `result_json` |
| Hermes | `plugins/hermes/` | on_session_start/on_session_reset → SessionStart, pre_llm_call → UserPromptSubmit, post_tool_call → PostToolUse, post_llm_call → Stop, on_session_end → SessionEnd | `context` field in JSON output | Lookup-table mapping; install.sh writes hook entries + allowlist into `~/.hermes/config.yaml` and registers a Python plugin (dashboard/serve backend needs plugin-discovery registration) |
| Antigravity | `plugins/antigravity/` | PreToolUse, PostToolUse, PreInvocation (invocationNum 0 → SessionStart, else UserPromptSubmit), Stop | PreToolUse: MCP `context_inject` call from `handlePre()` (writes `{"decision":"allow","reason":<ctx>}`); PreInvocation: `injectSteps.ephemeralMessage` via ContextStore | Separate entry modes: pre, post, preinvocation, stop; PostToolUse/PreInvocation enrichment reads the transcript (`transcript.ts`) |
| OpenCode | `src/adapters/opencode/plugin.ts` | session.created, message.updated, tool.execute.after, session.idle/deleted | N/A (no stdio hooks) | Native tool registration via `tool()`; server tools fetched via MCP `tools/list` (cached in `toolsCache`); `message.updated` emits empty `session_id`, `project_name` comes from the plugin's cwd arg |

### MCP relay

`runMcpRelay()` (each adapter's `mcp.ts`) proxies JSON-RPC to `${config.url}/api/mcp`:
- Handles `initialize` / `ping` / `notifications/initialized` locally rather than forwarding.
- Caches `tools/list` responses for 60s (`CACHE_TTL`); on fetch failure returns `{ tools: [] }`.
- Forwards `tools/call` frames verbatim (30s timeout).
- Reads stdin via LSP `Content-Length:` framing with a raw newline-delimited JSON fallback; always writes responses as `Content-Length` frames.

### Packaging

`scripts/package-plugins.mjs` uses esbuild to bundle each adapter's `cli.ts` + `mcp.ts` into a standalone CJS blob under `plugins/<platform>/dist/`. It writes the MCP relay config JSON (`.mcp.json`, `mcp_config.json`) inline — not from templates — and injects the plugin manifest `version` from the root `package.json` to keep them in sync. Hermes output gets a shebang + `chmod 755`; OpenCode bundles to ESM `dist/plugin.js` with no manifest.

### Fail-silent principle

The runner catches all errors from translate/sendEvent/logging. A malformed payload, unreachable server, or bad translate must never produce a nonzero exit, missing stdout, or stderr noise — the host platform's hook system would interpret that as the hook failing. `sendEvent()` never rejects: both success and failure funnel into `logOutcome`.

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
