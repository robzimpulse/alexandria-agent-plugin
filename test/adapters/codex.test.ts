// test/adapters/codex.test.ts
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../src/adapters/codex/translate.js";

function loadFixture(name: string): Record<string, unknown> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "test/fixtures/codex", `${name}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

describe("codex translate", () => {
  it("maps PostToolUse: event_data extracts tool fields", () => {
    const raw = loadFixture("PostToolUse");
    const event = translate(raw);

    expect(event).toMatchObject({
      session_id: raw.session_id,
      project_name: raw.cwd,
      platform: "codex",
      hook_event_name: "PostToolUse",
    });
    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: raw.tool_name,
      tool_input: raw.tool_input,
      tool_response: raw.tool_response,
    });
  });

  it("maps UserPromptSubmit: event_data carries prompt", () => {
    const raw = loadFixture("UserPromptSubmit");
    const event = translate(raw);

    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data).toEqual({
      prompt: raw.prompt ?? null,
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });

  for (const eventName of ["SessionStart", "Stop", "SessionEnd"]) {
    it(`maps ${eventName}: event_data all-null (signal-only)`, () => {
      const raw = loadFixture(eventName);
      const event = translate(raw);

      expect(event.hook_event_name).toBe(eventName);
      expect(event.event_data).toEqual({
        prompt: null,
        tool_name: null,
        tool_input: null,
        tool_response: null,
      });
    });
  }
});
