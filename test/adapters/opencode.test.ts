import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CanonicalHookEvent } from "../../src/core/schema.js";

import { createHandlers } from "../../src/adapters/opencode/translate.js";

const mockSend = vi.fn();

beforeEach(() => {
  mockSend.mockClear();
});

describe("opencode plugin handlers", () => {
  it("session.created sends SessionStart event", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["session.created"]({
      sessionID: "sess-1",
      projectID: "proj-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.session_id).toBe("sess-1");
    expect(event.platform).toBe("opencode");
    expect(event.hook_event_name).toBe("SessionStart");
    expect(event.cwd).toBe("/repo");
  });

  it("message.updated with user role sends UserPromptSubmit", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["message.updated"]({
      type: "message.updated",
      properties: {
        info: { role: "user", content: "hello" },
      },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("UserPromptSubmit");
  });

  it("message.updated with assistant role does nothing", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["message.updated"]({
      type: "message.updated",
      properties: {
        info: { role: "assistant", content: "response" },
      },
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("tool.execute.after sends PostToolUse", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["tool.execute.after"]({
      tool: "Bash",
      sessionID: "sess-1",
      callID: "call-1",
      args: { command: "ls" },
    }, {
      output: "file1 file2",
      metadata: { exitCode: 0 },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("PostToolUse");
    expect(event.tool_name).toBe("Bash");
    expect(event.tool_input).toEqual({ command: "ls" });
    expect(event.tool_response).toEqual({ output: "file1 file2", metadata: { exitCode: 0 } });
  });

  it("session.idle sends SessionEnd", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["session.idle"]({
      type: "session.idle",
      properties: { sessionID: "sess-1" },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("SessionEnd");
  });

  it("session.deleted sends SessionEnd", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["session.deleted"]({
      type: "session.deleted",
      properties: { sessionID: "sess-1" },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("SessionEnd");
  });
});
