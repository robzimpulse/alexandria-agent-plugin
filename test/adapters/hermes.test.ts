import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../src/adapters/hermes/translate.js";

function loadFixture(name: string): Record<string, any> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "test/fixtures/hermes", `${name}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

describe("hermes translate", () => {
  it("maps post_tool_call: event_data is structured EventData", () => {
    const raw = loadFixture("post_tool_call");
    const event = translate(raw);

    expect(event).toMatchObject({
      session_id: raw.session_id,
      project_name: raw.cwd,
      platform: "hermes",
      hook_event_name: "PostToolUse",
    });
    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: "terminal",
      tool_input: { command: "npm test" },
      tool_response: "5 passed",
    });
  });

  it("maps pre_llm_call → UserPromptSubmit with prompt from extra.user_message", () => {
    const raw = loadFixture("pre_llm_call");
    const event = translate(raw);

    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data).toEqual({
      prompt: "run the tests",
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });

  for (const [nativeName, canonicalName] of [
    ["on_session_start", "SessionStart"],
    ["on_session_reset", "SessionStart"],
    ["post_llm_call", "Stop"],
    ["on_session_end", "SessionEnd"],
  ] as const) {
    it(`maps ${nativeName} → ${canonicalName}: event_data all-null (signal-only)`, () => {
      const raw = loadFixture(nativeName);
      const event = translate(raw);

      expect(event.hook_event_name).toBe(canonicalName);
      expect(event.event_data).toEqual({
        prompt: null,
        tool_name: null,
        tool_input: null,
        tool_response: null,
      });
    });
  }
});
