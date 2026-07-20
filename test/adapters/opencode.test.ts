import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CanonicalHookEvent } from "../../src/core/schema.js";
import { createHandlers } from "../../src/adapters/opencode/translate.js";

const mockSend = vi.fn();

beforeEach(() => {
  mockSend.mockClear();
});

describe("opencode plugin handlers", () => {
  it("session.created sends SessionStart with event_data", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { sessionID: "sess-1", projectID: "proj-1" };
    await handlers["session.created"](input);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.session_id).toBe("sess-1");
    expect(event.project_name).toBe("/repo");
    expect(event.platform).toBe("opencode");
    expect(event.hook_event_name).toBe("SessionStart");
    expect(event.event_data).toEqual(input);
  });

  it("message.updated with user role sends UserPromptSubmit with event_data", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = {
      type: "message.updated",
      properties: { info: { role: "user", content: "hello" } },
    };
    await handlers["message.updated"](input);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data).toEqual(input);
  });

  it("message.updated with assistant role does nothing", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["message.updated"]({
      type: "message.updated",
      properties: { info: { role: "assistant", content: "response" } },
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("tool.execute.after sends PostToolUse with event_data containing input+output", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { tool: "Bash", sessionID: "sess-1", callID: "call-1", args: { command: "ls" } };
    const output = { output: "file1 file2", metadata: { exitCode: 0 } };
    await handlers["tool.execute.after"](input, output);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("PostToolUse");
    expect(event.event_data).toEqual({ input, output });
  });

  it("session.idle sends SessionEnd", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { type: "session.idle", properties: { sessionID: "sess-1" } };
    await handlers["session.idle"](input);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("SessionEnd");
  });

  it("session.deleted sends SessionEnd", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { type: "session.deleted", properties: { sessionID: "sess-1" } };
    await handlers["session.deleted"](input);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("SessionEnd");
  });
});
