// src/core/runner.ts
import type { CanonicalHookEvent } from "./schema.js";
import { ContextStore } from "./context-store.js";
import { sendEvent } from "./client.js";
import { loadConfig } from "./config.js";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, join, normalize } from "node:path";
import { existsSync } from "node:fs";

/**
 * Each platform has its own hook output protocol for injecting context.
 * This returns the correct format for (platform, event) so the host agent
 * actually receives the text.
 *
 * Verified against:
 *   Claude Code:   https://code.claude.com/docs/en/hooks#add-context-for-claude
 *   Codex:         https://learn.chatgpt.com/docs/hooks
 *   Hermes:        https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
 *   Antigravity:   https://antigravity.google/docs/hooks
 */
export function formatHookOutput(
  platform: string,
  hookEventName: string,
  contextText: string,
): Record<string, unknown> {
  switch (platform) {
    case "hermes":
      // pre_llm_call expects {"context": "..."} — injected into user message
      return { context: contextText };
    case "antigravity":
      if (hookEventName === "UserPromptSubmit") {
        // PreInvocation injects ephemeral messages via injectSteps
        return { injectSteps: [{ ephemeralMessage: contextText }] };
      }
      // PostToolUse on antigravity has no context injection mechanism
      return {};
    default:
      // claude-code, codex, cursor:
      //   hookSpecificOutput.additionalContext wraps text as a system
      //   reminder injected at the event position in the conversation.
      //   hookEventName is required inside hookSpecificOutput.
      return {
        hookSpecificOutput: {
          hookEventName,
          additionalContext: contextText,
        },
      };
  }
}

const HERMES_HOME = normalize(join(homedir(), ".hermes"));
const STATE_DB = join(HERMES_HOME, "state.db");

function resolveProjectPath(cwd: string): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd;
  }
}

function resolveProjectName(session_id: string, cwd: string): string {
  // Tier 0: state.db git_repo_root (Hermes sets this for projects/repos)
  if (session_id && existsSync(STATE_DB)) {
    try {
      const rows = execSync(
        `sqlite3 "${STATE_DB}" "SELECT git_repo_root, cwd FROM sessions WHERE id='${session_id.replace(/'/g, "''")}'"`,
        { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }
      ).trim().split("|");
      if (rows.length >= 2) {
        const gitRoot = rows[0];
        const dbCwd = rows[1];
        const root = gitRoot ? gitRoot : (dbCwd ? resolveProjectPath(dbCwd) : "");
        if (root) return basename(root);
      }
    } catch {
      // fall through
    }
  }

  // Tier 1: git rev-parse from payload cwd
  const gitRoot = resolveProjectPath(cwd);
  if (gitRoot) return basename(gitRoot);

  // Tier 2: basename of cwd
  if (cwd) return basename(cwd);

  // Tier 3: fallback
  return "General";
}

export type RunnerIO = {
  readStdin: () => Promise<string>;
  writeStdout: (text: string) => void;
  exit: (code: number) => void;
};

export type RunStdioHookOptions = {
  contextStore?: ContextStore;
};

const defaultIO: RunnerIO = {
  readStdin: () =>
    new Promise((resolve) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data));
    }),
  writeStdout: (text) => {
    process.stdout.write(text);
  },
  exit: (code) => {
    process.exit(code);
  },
};

export async function runStdioHook(
  translate: (raw: unknown) => CanonicalHookEvent | Promise<CanonicalHookEvent>,
  stdout: string = "{}",
  io: RunnerIO = defaultIO,
  options?: RunStdioHookOptions,
): Promise<void> {
  try {
    const raw = JSON.parse(await io.readStdin());
    const event = await translate(raw);
    event.project_name = resolveProjectName(event.session_id, event.project_name);
    await sendEvent(event, loadConfig());

    // Fetch incremental context for UserPromptSubmit and PostToolUse
    if (
      (event.hook_event_name === "UserPromptSubmit" || event.hook_event_name === "PostToolUse") &&
      options?.contextStore
    ) {
      const contextText = await options.contextStore.refresh(
        loadConfig().url,
        loadConfig().apiKey,
        event.session_id,
        [event.project_name],
        event.platform,
      );
      if (contextText) {
        io.writeStdout(JSON.stringify(
          formatHookOutput(event.platform, event.hook_event_name, contextText),
        ));
        io.exit(0);
        return;
      }
    }
  } catch {
    // Fail-silent: a bad/malformed translate() must never surface as a
    // nonzero exit, missing stdout, or stderr noise to the host platform.
  }
  io.writeStdout(stdout);
  io.exit(0);
}
