import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  translatePostToolUse,
  translatePreInvocation,
  translateStop,
} from "../../src/adapters/antigravity/translate.js";

function loadFixture(name: string): Record<string, any> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "test/fixtures/antigravity", `${name}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

describe("antigravity translatePostToolUse", () => {
  it("parses transcript.jsonl and produces structured EventData", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");

    const event = await translatePostToolUse(raw);

    expect(event.session_id).toBe(raw.conversationId);
    expect(event.platform).toBe("antigravity");
    expect(event.hook_event_name).toBe("PostToolUse");
    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: "run_command",
      tool_input: { CommandLine: "npm test" },
      tool_response: { stdout: "5 passed", exitCode: 0 },
    });
  });

  it("degrades gracefully when transcript file doesn't exist — all tool fields null", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = "/nonexistent/path/transcript.jsonl";

    const event = await translatePostToolUse(raw);

    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });

  it("degrades gracefully when no entry matches stepIdx — all tool fields null", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");
    raw.stepIdx = 999;

    const event = await translatePostToolUse(raw);

    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });
});

describe("antigravity translatePreInvocation", () => {
  it("maps invocationNum 0 to SessionStart with all-null event_data", async () => {
    const raw = loadFixture("PreInvocation-SessionStart");
    const event = await translatePreInvocation(raw);

    expect(event.hook_event_name).toBe("SessionStart");
    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });

  it("maps non-zero invocationNum to UserPromptSubmit with null prompt", async () => {
    const raw = loadFixture("PreInvocation-UserPromptSubmit");
    const event = await translatePreInvocation(raw);

    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data).toEqual({
      prompt: null,  // Antigravity transcript doesn't store user prompts
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });
});

describe("antigravity translateStop", () => {
  it("maps to Stop with all-null event_data", () => {
    const raw = loadFixture("Stop");
    const event = translateStop(raw);

    expect(event.hook_event_name).toBe("Stop");
    expect(event.event_data).toEqual({
      prompt: null,
      tool_name: null,
      tool_input: null,
      tool_response: null,
    });
  });
});
