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
  it("maps post_tool_call: event_data carries the full raw payload", () => {
    const raw = loadFixture("post_tool_call");
    const event = translate(raw);

    expect(event).toEqual({
      session_id: raw.session_id,
      project_name: raw.cwd,
      platform: "hermes",
      hook_event_name: "PostToolUse",
      event_data: raw,
    });
  });

  for (const [nativeName, canonicalName] of [
    ["on_session_start", "SessionStart"],
    ["on_session_reset", "SessionStart"],
    ["pre_llm_call", "UserPromptSubmit"],
    ["post_llm_call", "Stop"],
    ["on_session_end", "SessionEnd"],
  ] as const) {
    it(`maps ${nativeName} → ${canonicalName}: event_data carries full payload`, () => {
      const raw = loadFixture(nativeName);
      const event = translate(raw);

      expect(event).toEqual({
        session_id: raw.session_id,
        project_name: raw.cwd,
        platform: "hermes",
        hook_event_name: canonicalName,
        event_data: raw,
      });
    });
  }
});
