// test/adapters/claude-code.test.ts
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../src/adapters/claude-code/translate.js";

function loadFixture(name: string): Record<string, unknown> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "test/fixtures/claude-code", `${name}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

describe("claude-code translate", () => {
  it("maps PostToolUse: event_data carries the full raw payload, no field stripping", () => {
    const raw = loadFixture("PostToolUse");
    const event = translate(raw);

    expect(event).toEqual({
      session_id: raw.session_id,
      project_name: raw.cwd,
      platform: "claude-code",
      hook_event_name: "PostToolUse",
      event_data: raw,
    });
  });

  for (const eventName of ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"]) {
    it(`maps ${eventName}: event_data carries the full raw payload`, () => {
      const raw = loadFixture(eventName);
      const event = translate(raw);

      expect(event).toEqual({
        session_id: raw.session_id,
        project_name: raw.cwd,
        platform: "claude-code",
        hook_event_name: eventName,
        event_data: raw,
      });
    });
  }
});
