// src/core/runner.ts
import type { CanonicalHookEvent } from "./schema.js";
import { sendEvent } from "./client.js";
import { loadConfig } from "./config.js";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join, normalize } from "node:path";
import { existsSync } from "node:fs";

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

function resolveHermesCwd(session_id: string, cwd: string): string {
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
        if (gitRoot) return gitRoot;
        if (dbCwd) {
          const r = resolveProjectPath(dbCwd);
          if (r !== dbCwd) return r;
        }
      }
    } catch {
      // fall through
    }
  }

  // Tier 1: git rev-parse from payload cwd
  const gitRoot = resolveProjectPath(cwd);
  if (gitRoot !== cwd) return gitRoot;

  // Tier 2: fallback
  return cwd;
}

export type RunnerIO = {
  readStdin: () => Promise<string>;
  writeStdout: (text: string) => void;
  exit: (code: number) => void;
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
  io: RunnerIO = defaultIO
): Promise<void> {
  try {
    const raw = JSON.parse(await io.readStdin());
    const event = await translate(raw);
    event.cwd = resolveHermesCwd(event.session_id, event.cwd);
    await sendEvent(event, loadConfig());
  } catch {
    // Fail-silent: a bad/malformed translate() must never surface as a
    // nonzero exit, missing stdout, or stderr noise to the host platform.
  }
  io.writeStdout(stdout);
  io.exit(0);
}
