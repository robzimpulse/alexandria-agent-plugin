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
  it("maps PostToolUse: event_data extracts tool fields", async () => {
    const raw = loadFixture("PostToolUse");
    const event = await translate(raw);

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

  it("maps UserPromptSubmit: reads prompt from transcript_path when prompt field absent", async () => {
    const raw = loadFixture("UserPromptSubmit");
    raw.transcript_path = path.join(process.cwd(), "test/fixtures/codex/transcript.jsonl");
    const event = await translate(raw);

    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data.prompt).toBe("add tests for the new endpoint");
    expect(event.event_data.tool_name).toBeNull();
  });

  it("maps UserPromptSubmit: uses inline prompt when present", async () => {
    const raw = loadFixture("UserPromptSubmit");
    (raw as any).prompt = "inline codex prompt";
    const event = await translate(raw);

    expect(event.event_data.prompt).toBe("inline codex prompt");
  });

  for (const eventName of ["SessionStart", "Stop", "SessionEnd"]) {
    it(`maps ${eventName}: event_data all-null (signal-only)`, async () => {
      const raw = loadFixture(eventName);
      const event = await translate(raw);

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
