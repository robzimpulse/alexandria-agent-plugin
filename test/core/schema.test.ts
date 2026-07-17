// test/core/schema.test.ts
import { describe, it, expect } from "vitest";
import type { CanonicalHookEvent } from "../../src/core/schema.js";

describe("CanonicalHookEvent", () => {
  it("allows a full tool event with all fields set", () => {
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      cwd: "/repo",
      platform: "claude-code",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_response: { output: "file.txt" },
    };

    expect(event.platform).toBe("claude-code");
  });

  it("allows a lifecycle event with the optional tool_* fields omitted", () => {
    const event: CanonicalHookEvent = {
      session_id: "sess-1",
      cwd: "/repo",
      platform: "claude-code",
      hook_event_name: "SessionStart",
    };

    expect(event.tool_name).toBeUndefined();
    expect(event.tool_input).toBeUndefined();
    expect(event.tool_response).toBeUndefined();
  });
});
