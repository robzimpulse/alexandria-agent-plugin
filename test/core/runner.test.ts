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
import { formatHookOutput } from "../../src/core/runner.js";
import { sendEvent } from "../../src/core/client.js";
import type { CanonicalHookEvent } from "../../src/core/schema.js";
import { buildEventData } from "../../src/adapters/shared/buildEventData.js";
import { ContextStore } from "../../src/core/context-store.js";

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
      event_data: buildEventData({ tool_name: "Bash" }),
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
      event_data: buildEventData(),
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
        event_data: buildEventData(),
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

  it("returns hookSpecificOutput.additionalContext when contextStore provides text (claude-code)", async () => {
    const raw = { hook_event_name: "UserPromptSubmit" };
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "/repo",
      platform: "claude-code",
      hook_event_name: "UserPromptSubmit",
      event_data: buildEventData({ prompt: "hello" }),
    };
    const translate = vi.fn(() => event);
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify(raw));

    const mockStore = {
      refresh: vi.fn(async () => "<alexandria-context>mock</alexandria-context>"),
      clearAll: vi.fn(),
      clearSession: vi.fn(),
    } as unknown as ContextStore;

    await runStdioHook(translate, "{}", io, { contextStore: mockStore });

    expect(mockStore.refresh).toHaveBeenCalled();
    expect(stdoutWrites.length).toBe(1);
    const parsed = JSON.parse(stdoutWrites[0]);
    expect(parsed.hookSpecificOutput.additionalContext).toBe("<alexandria-context>mock</alexandria-context>");
    expect(parsed.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    expect(exitCodes).toEqual([0]);
  });

  it("uses context field for hermes platform", async () => {
    const raw = { hook_event_name: "UserPromptSubmit" };
    const event: CanonicalHookEvent = {
      session_id: "sess-2",
      project_name: "/repo",
      platform: "hermes",
      hook_event_name: "UserPromptSubmit",
      event_data: buildEventData({ prompt: "hello" }),
    };
    const translate = vi.fn(() => event);
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify(raw));

    const mockStore = {
      refresh: vi.fn(async () => "<alexandria-context>mock</alexandria-context>"),
      clearAll: vi.fn(),
      clearSession: vi.fn(),
    } as unknown as ContextStore;

    await runStdioHook(translate, "{}", io, { contextStore: mockStore });

    expect(stdoutWrites.length).toBe(1);
    const parsed = JSON.parse(stdoutWrites[0]);
    expect(parsed.context).toBe("<alexandria-context>mock</alexandria-context>");
    expect(exitCodes).toEqual([0]);
  });

  it("uses injectSteps for antigravity UserPromptSubmit", async () => {
    const raw = { hook_event_name: "UserPromptSubmit" };
    const event: CanonicalHookEvent = {
      session_id: "sess-3",
      project_name: "/repo",
      platform: "antigravity",
      hook_event_name: "UserPromptSubmit",
      event_data: buildEventData({ prompt: "hello" }),
    };
    const translate = vi.fn(() => event);
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify(raw));

    const mockStore = {
      refresh: vi.fn(async () => "<alexandria-context>mock</alexandria-context>"),
      clearAll: vi.fn(),
      clearSession: vi.fn(),
    } as unknown as ContextStore;

    await runStdioHook(translate, "{}", io, { contextStore: mockStore });

    expect(stdoutWrites.length).toBe(1);
    const parsed = JSON.parse(stdoutWrites[0]);
    expect(parsed.injectSteps).toEqual([{ ephemeralMessage: "<alexandria-context>mock</alexandria-context>" }]);
    expect(exitCodes).toEqual([0]);
  });

  it("returns empty for antigravity PostToolUse", async () => {
    const raw = { hook_event_name: "PostToolUse" };
    const event: CanonicalHookEvent = {
      session_id: "sess-4",
      project_name: "/repo",
      platform: "antigravity",
      hook_event_name: "PostToolUse",
      event_data: buildEventData({ tool_name: "Bash" }),
    };
    const translate = vi.fn(() => event);
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify(raw));

    const mockStore = {
      refresh: vi.fn(async () => "<alexandria-context>mock</alexandria-context>"),
      clearAll: vi.fn(),
      clearSession: vi.fn(),
    } as unknown as ContextStore;

    await runStdioHook(translate, "{}", io, { contextStore: mockStore });

    expect(stdoutWrites.length).toBe(1);
    const parsed = JSON.parse(stdoutWrites[0]);
    expect(parsed).toEqual({});
    expect(exitCodes).toEqual([0]);
  });

  describe("formatHookOutput", () => {
    it("returns hookSpecificOutput for claude-code", () => {
      const result = formatHookOutput("claude-code", "UserPromptSubmit", "test");
      expect(result).toEqual({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "test" } });
    });

    it("returns hookSpecificOutput for codex", () => {
      const result = formatHookOutput("codex", "UserPromptSubmit", "test");
      expect(result).toEqual({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "test" } });
    });

    it("returns hookSpecificOutput for cursor", () => {
      const result = formatHookOutput("cursor", "PostToolUse", "test");
      expect(result).toEqual({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "test" } });
    });

    it("returns context for hermes", () => {
      const result = formatHookOutput("hermes", "UserPromptSubmit", "test");
      expect(result).toEqual({ context: "test" });
    });

    it("returns injectSteps for antigravity UserPromptSubmit", () => {
      const result = formatHookOutput("antigravity", "UserPromptSubmit", "test");
      expect(result).toEqual({ injectSteps: [{ ephemeralMessage: "test" }] });
    });

    it("returns empty for antigravity PostToolUse", () => {
      const result = formatHookOutput("antigravity", "PostToolUse", "test");
      expect(result).toEqual({});
    });
  });

  it("falls back to default stdout when contextStore returns null", async () => {
    const raw = { hook_event_name: "UserPromptSubmit" };
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "/repo",
      platform: "claude-code",
      hook_event_name: "UserPromptSubmit",
      event_data: buildEventData({ prompt: "hello" }),
    };
    const translate = vi.fn(() => event);
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify(raw));

    const mockStore = {
      refresh: vi.fn(async () => null),
      clearAll: vi.fn(),
      clearSession: vi.fn(),
    } as unknown as ContextStore;

    await runStdioHook(translate, "{}", io, { contextStore: mockStore });

    expect(mockStore.refresh).toHaveBeenCalled();
    expect(stdoutWrites).toEqual(["{}"]);
    expect(exitCodes).toEqual([0]);
  });

  it("still works without options (backward compat)", async () => {
    const raw = { hook_event_name: "PostToolUse" };
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "/repo",
      platform: "claude-code",
      hook_event_name: "PostToolUse",
      event_data: buildEventData({ tool_name: "Bash" }),
    };
    const translate = vi.fn(() => event);
    const { io, stdoutWrites, exitCodes } = fakeIO(JSON.stringify(raw));

    await runStdioHook(translate, "{}", io);

    expect(translate).toHaveBeenCalled();
    expect(stdoutWrites).toEqual(["{}"]);
    expect(exitCodes).toEqual([0]);
  });
});
