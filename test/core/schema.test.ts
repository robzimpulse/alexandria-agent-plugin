// test/core/schema.test.ts
import { describe, it, expect } from "vitest";
import type { CanonicalHookEvent, EventData } from "../../src/core/schema.js";
import { buildEventData } from "../../src/adapters/shared/buildEventData.js";

describe("CanonicalHookEvent", () => {
  it("allows a full tool event with event_data", () => {
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "my-project",
      platform: "claude-code",
      hook_event_name: "PostToolUse",
      event_data: {
        prompt: null,
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_response: { output: "file.txt" },
      },
    };

    expect(event.platform).toBe("claude-code");
    expect(event.event_data).toBeDefined();
  });

  it("allows a lifecycle event with minimal fields", () => {
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "my-project",
      platform: "claude-code",
      hook_event_name: "SessionStart",
      event_data: {
        prompt: null,
        tool_name: null,
        tool_input: null,
        tool_response: null,
      },
    };

    expect(event.project_name).toBe("my-project");
  });
});

describe("buildEventData", () => {
  it("returns all-null when called with no args", () => {
    const data = buildEventData();
    expect(data).toEqual({
      prompt: null,
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });

  it("overrides specified fields, leaves others null", () => {
    const data = buildEventData({ tool_name: "Bash", tool_input: { command: "ls" } });
    expect(data.prompt).toBeNull();
    expect(data.tool_name).toBe("Bash");
    expect(data.tool_input).toEqual({ command: "ls" });
    expect(data.tool_response).toBeNull();
  });
});
