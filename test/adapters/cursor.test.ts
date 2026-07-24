import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../src/adapters/cursor/translate.js";

function loadFixture(name: string): Record<string, any> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "test/fixtures/cursor", `${name}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

describe("cursor translate", () => {
  it("maps PostToolUse: restructures Cursor fields into canonical event_data", async () => {
    const raw = loadFixture("PostToolUse");
    const event = await translate(raw);

    expect(event).toMatchObject({
      session_id: raw.conversation_id,
      platform: "cursor",
      hook_event_name: "PostToolUse",
    });
    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: "write_file",
      tool_input: {
        filePath: "src/auth/handler.go",
        edits: [{"range": {"start": 10, "end": 20}, "text": "func newHandler() {}"}],
      },
      tool_response: '{"success": true}',
    });
  });

  it("maps UserPromptSubmit: uses inline prompt when present", async () => {
    const raw = loadFixture("UserPromptSubmit");
    const event = await translate(raw);

    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data.prompt).toBe("add rate limiting to the auth handler");
  });

  it("maps UserPromptSubmit: reads prompt from transcript_path when absent", async () => {
    const raw = loadFixture("UserPromptSubmit");
    delete (raw as any).prompt;
    raw.transcript_path = path.join(process.cwd(), "test/fixtures/cursor/transcript.jsonl");
    const event = await translate(raw);

    expect(event.event_data.prompt).toBe("add rate limiting");
  });
});