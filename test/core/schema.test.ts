// test/core/schema.test.ts
import { describe, it, expect } from "vitest";
import type { CanonicalHookEvent } from "../../src/core/schema.js";

describe("CanonicalHookEvent", () => {
  it("allows a full tool event with event_data", () => {
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      project_name: "my-project",
      platform: "claude-code",
      hook_event_name: "PostToolUse",
      event_data: { tool_name: "Bash", tool_input: { command: "ls" }, tool_response: { output: "file.txt" } },
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
      event_data: {},
    };

    expect(event.project_name).toBe("my-project");
  });
});
