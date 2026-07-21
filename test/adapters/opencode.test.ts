import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CanonicalHookEvent } from "../../src/core/schema.js";
import { createHandlers } from "../../src/adapters/opencode/translate.js";

const mockSend = vi.fn();

beforeEach(() => {
  mockSend.mockClear();
});

describe("opencode plugin handlers", () => {
  it("session.created sends SessionStart with all-null event_data", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { sessionID: "sess-1", projectID: "proj-1" };
    await handlers["session.created"](input);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("SessionStart");
    expect(event.event_data).toEqual({
      prompt: null, tool_name: null, tool_input: null, tool_response: null,
    });
  });

  it("message.updated with user role sends UserPromptSubmit with prompt", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = {
      type: "message.updated",
      properties: { info: { role: "user", content: "hello" } },
    };
    await handlers["message.updated"](input);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data).toEqual({
      prompt: "hello",
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });

  it("message.updated with assistant role does nothing", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    await handlers["message.updated"]({
      type: "message.updated",
      properties: { info: { role: "assistant", content: "response" } },
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("tool.execute.after sends PostToolUse with tool fields", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { tool: "Bash", sessionID: "sess-1", callID: "call-1", args: { command: "ls" } };
    const output = { output: "file1 file2", metadata: { exitCode: 0 } };
    await handlers["tool.execute.after"](input, output);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("PostToolUse");
    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_response: "file1 file2",
    });
  });

  it("session.idle sends SessionEnd with all-null event_data", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { type: "session.idle", properties: { sessionID: "sess-1" } };
    await handlers["session.idle"](input);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("SessionEnd");
    expect(event.event_data).toEqual({
      prompt: null, tool_name: null, tool_input: null, tool_response: null,
    });
  });

  it("session.deleted sends SessionEnd with all-null event_data", async () => {
    const handlers = createHandlers(mockSend, "/repo");
    const input = { type: "session.deleted", properties: { sessionID: "sess-1" } };
    await handlers["session.deleted"](input);
    const event = mockSend.mock.calls[0][0] as CanonicalHookEvent;
    expect(event.hook_event_name).toBe("SessionEnd");
    expect(event.event_data).toEqual({
      prompt: null, tool_name: null, tool_input: null, tool_response: null,
    });
  });
});
