// test/core/client.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { sendEvent } from "../../src/core/client.js";
import type { CanonicalHookEvent } from "../../src/core/schema.js";
import type { Config } from "../../src/core/config.js";

let logDir: string;

const event: CanonicalHookEvent = {
  session_id: "sess-1",
  project_name: "/repo",
  platform: "claude-code",
  hook_event_name: "PostToolUse",
  event_data: {
    prompt: null,
    tool_name: "Bash",
    tool_input: { command: "ls" },
    tool_response: { output: "file.txt" },
  },
};

beforeEach(() => {
  logDir = fs.mkdtempSync(path.join(os.tmpdir(), "alexandria-client-test-"));
});

afterEach(() => {
  fs.rmSync(logDir, { recursive: true, force: true });
});

describe("sendEvent", () => {
  it("POSTs the event to <url>/api/hooks with no Authorization header when apiKey is absent", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const config: Config = { url: "https://alexandria.example.com" };

    await sendEvent(event, config, { fetchFn: fetchFn as unknown as typeof fetch, logDir });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("https://alexandria.example.com/api/hooks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(event);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("adds a Bearer Authorization header when apiKey is present", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const config: Config = { url: "https://alexandria.example.com", apiKey: "secret-key" };

    await sendEvent(event, config, { fetchFn: fetchFn as unknown as typeof fetch, logDir });

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
  });

  it("writes a SUCCESS log line on a successful 2xx response", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const config: Config = { url: "https://alexandria.example.com" };

    await expect(
      sendEvent(event, config, { fetchFn: fetchFn as unknown as typeof fetch, logDir })
    ).resolves.toBeUndefined();

    const logEntry = JSON.parse(fs.readFileSync(path.join(logDir, "plugin.log"), "utf8").trim());
    expect(logEntry.platform).toBe("claude-code");
    expect(logEntry.hook_event_name).toBe("PostToolUse");
    expect(logEntry.status).toBe("SUCCESS");
  });

  it("logs and swallows a non-2xx response instead of throwing", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 500 }));
    const config: Config = { url: "https://alexandria.example.com" };

    await expect(
      sendEvent(event, config, { fetchFn: fetchFn as unknown as typeof fetch, logDir })
    ).resolves.toBeUndefined();

    const logEntry = JSON.parse(fs.readFileSync(path.join(logDir, "plugin.log"), "utf8").trim());
    expect(logEntry.platform).toBe("claude-code");
    expect(logEntry.hook_event_name).toBe("PostToolUse");
    expect(logEntry.status).toBe("FAIL");
    expect(logEntry.error).toContain("500");
  });

  it("logs and swallows a fetch rejection (e.g. a timeout abort) instead of throwing", async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const config: Config = { url: "https://alexandria.example.com" };

    await expect(
      sendEvent(event, config, { fetchFn: fetchFn as unknown as typeof fetch, logDir })
    ).resolves.toBeUndefined();

    const logEntry = JSON.parse(fs.readFileSync(path.join(logDir, "plugin.log"), "utf8").trim());
    expect(logEntry.status).toBe("FAIL");
    expect(logEntry.error).toContain("aborted");
  });
});
