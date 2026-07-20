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
  it("maps PostToolUse: tool_name/tool_input/tool_response pass through, everything else dropped", () => {
    const raw = loadFixture("PostToolUse");

    const event = translate(raw);

    expect(event).toEqual({
      session_id: raw.session_id,
      cwd: raw.cwd,
      platform: "codex",
      hook_event_name: "PostToolUse",
      tool_name: raw.tool_name,
      tool_input: raw.tool_input,
      tool_response: raw.tool_response,
    });
  });

  for (const eventName of ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"]) {
    it(`maps ${eventName}: tool_name/tool_input/tool_response all absent`, () => {
      const raw = loadFixture(eventName);

      const event = translate(raw);

      expect(event).toEqual({
        session_id: raw.session_id,
        cwd: raw.cwd,
        platform: "codex",
        hook_event_name: eventName,
      });
      expect(event.tool_name).toBeUndefined();
      expect(event.tool_input).toBeUndefined();
      expect(event.tool_response).toBeUndefined();
    });
  }
});
