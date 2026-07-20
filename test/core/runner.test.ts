// test/core/runner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/core/client.js", () => ({
  sendEvent: vi.fn(async () => undefined),
}));
vi.mock("../../src/core/config.js", () => ({
  loadConfig: vi.fn(() => ({ url: "https://alexandria.example.com" })),
}));

import { runStdioHook } from "../../src/core/runner.js";
import type { RunnerIO } from "../../src/core/runner.js";
import { sendEvent } from "../../src/core/client.js";
import type { CanonicalHookEvent } from "../../src/core/schema.js";

function fakeIO(input: string) {
  const stdoutWrites: string[] = [];
  const exitCodes: number[] = [];
  const io: RunnerIO = {
    readStdin: async () => input,
    writeStdout: (text) => stdoutWrites.push(text),
    exit: (code) => exitCodes.push(code),
  };
  return { io, stdoutWrites, exitCodes };
}

beforeEach(() => {
  vi.mocked(sendEvent).mockClear();
});

describe("runStdioHook", () => {
  it("parses stdin, calls translate and sendEvent, writes the default stdout literal, and exits 0", async () => {
    const raw = { hook_event_name: "PostToolUse" };
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "/repo",
      platform: "claude-code",
      hook_event_name: "PostToolUse",
      event_data: { hook_event_name: "PostToolUse" },
    };
    const translate = vi.fn(() => event);
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify(raw));

    await runStdioHook(translate, "{}", io);

    expect(translate).toHaveBeenCalledWith(raw);
    expect(sendEvent).toHaveBeenCalledWith(event, { url: "https://alexandria.example.com" });
    expect(stdoutWrites).toEqual(["{}"]);
    expect(exitCodes).toEqual([0]);
  });

  it("supports an async translate function", async () => {
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "/repo",
      platform: "antigravity",
      hook_event_name: "PostToolUse",
      event_data: {},
    };
    const translate = vi.fn(async () => event);
    const { io, exitCodes } = fakeIO(JSON.stringify({}));

    await runStdioHook(translate, "{}", io);

    expect(sendEvent).toHaveBeenCalledWith(event, expect.anything());
    expect(exitCodes).toEqual([0]);
  });

  it("writes a custom stdout literal when provided", async () => {
    const translate = vi.fn(
      (): CanonicalHookEvent => ({
        session_id: "s",
        project_name: "/repo",
        platform: "antigravity",
        hook_event_name: "PreToolUse",
        event_data: {},
      })
    );
    const { io, stdoutWrites } = fakeIO(JSON.stringify({}));

    await runStdioHook(translate, '{"decision":"allow"}', io);

    expect(stdoutWrites).toEqual(['{"decision":"allow"}']);
  });

  it("still writes stdout and exits 0 when stdin is malformed JSON", async () => {
    const translate = vi.fn();
    const { io, stdoutWrites, exitCodes } = fakeIO("not valid json");

    await runStdioHook(translate, "{}", io);

    expect(translate).not.toHaveBeenCalled();
    expect(stdoutWrites).toEqual(["{}"]);
    expect(exitCodes).toEqual([0]);
  });

  it("still writes stdout and exits 0 when translate throws", async () => {
    const translate = vi.fn(() => {
      throw new Error("boom");
    });
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify({}));

    await runStdioHook(translate, "{}", io);

    expect(stdoutWrites).toEqual(["{}"]);
    expect(exitCodes).toEqual([0]);
  });
});
