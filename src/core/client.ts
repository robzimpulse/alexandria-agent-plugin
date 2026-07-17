// src/core/client.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { CanonicalHookEvent } from "./schema.js";
import type { Config } from "./config.js";

export type SendEventDeps = {
  fetchFn?: typeof fetch;
  logDir?: string;
  timeoutMs?: number;
};

export async function sendEvent(
  event: CanonicalHookEvent,
  config: Config,
  deps: SendEventDeps = {}
): Promise<void> {
  const fetchFn = deps.fetchFn ?? fetch;
  const logDir = deps.logDir ?? path.join(os.homedir(), ".alexandria");
  const timeoutMs = deps.timeoutMs ?? 3000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetchFn(`${config.url}/api/hooks`, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`POST /api/hooks failed with status ${response.status}`);
    }
  } catch (err) {
    logFailure(event, err, logDir);
  }
}

function logFailure(event: CanonicalHookEvent, err: unknown, logDir: string): void {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      platform: event.platform,
      hook_event_name: event.hook_event_name,
      error: err instanceof Error ? err.message : String(err),
    });
    fs.appendFileSync(path.join(logDir, "plugin.log"), line + "\n");
  } catch {
    // Logging a failure must never itself throw.
  }
}
