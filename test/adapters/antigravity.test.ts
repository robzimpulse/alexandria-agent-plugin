import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  translatePreToolUse,
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

describe("antigravity translatePreToolUse", () => {
  it("maps PreToolUse: event_data carries full raw payload", () => {
    const raw = loadFixture("PreToolUse");
    const event = translatePreToolUse(raw);

    expect(event).toEqual({
      session_id: raw.conversationId,
      project_name: raw.workspacePaths[0],
      platform: "antigravity",
      hook_event_name: "PreToolUse",
      event_data: raw,
    });
  });

  it("never throws on a malformed payload (missing toolCall)", () => {
    const raw = { conversationId: "c1", workspacePaths: ["/tmp"] };
    const event = translatePreToolUse(raw);

    expect(event.session_id).toBe("c1");
    expect(event.event_data).toEqual(raw);
  });

  it("falls back to an empty project_name when workspacePaths is empty", () => {
    const raw = { conversationId: "c1", workspacePaths: [] };
    const event = translatePreToolUse(raw);

    expect(event.project_name).toBe("");
  });
});

describe("antigravity translatePostToolUse", () => {
  it("parses transcript.jsonl and enriches event_data with toolName/args/result", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");

    const event = await translatePostToolUse(raw);

    expect(event.session_id).toBe(raw.conversationId);
    expect(event.project_name).toBe(raw.workspacePaths[0]);
    expect(event.platform).toBe("antigravity");
    expect(event.hook_event_name).toBe("PostToolUse");
    // event_data should be the raw payload merged with transcript fields
    expect(event.event_data).toHaveProperty("toolName", "run_command");
    expect(event.event_data).toHaveProperty("args", { CommandLine: "npm test" });
    expect(event.event_data).toHaveProperty("result", { stdout: "5 passed", exitCode: 0 });
    expect(event.event_data).toHaveProperty("stepIdx", 19);
  });

  it("degrades gracefully when the transcript file doesn't exist, event_data is unchanged raw payload", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = "/nonexistent/path/transcript.jsonl";

    const event = await translatePostToolUse(raw);

    expect(event.hook_event_name).toBe("PostToolUse");
    expect(event.event_data).toEqual(raw);
  });

  it("degrades gracefully when no entry in the transcript matches stepIdx, event_data is unchanged raw payload", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");
    raw.stepIdx = 999;

    const event = await translatePostToolUse(raw);

    expect(event.event_data).toEqual(raw);
  });
});

describe("antigravity translatePreInvocation", () => {
  it("maps invocationNum 0 to SessionStart", () => {
    const raw = loadFixture("PreInvocation-SessionStart");
    const event = translatePreInvocation(raw);

    expect(event).toEqual({
      session_id: raw.conversationId,
      project_name: raw.workspacePaths[0],
      platform: "antigravity",
      hook_event_name: "SessionStart",
      event_data: raw,
    });
  });

  it("maps a non-zero invocationNum to UserPromptSubmit", () => {
    const raw = loadFixture("PreInvocation-UserPromptSubmit");
    const event = translatePreInvocation(raw);

    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.event_data).toEqual(raw);
  });
});

describe("antigravity translateStop", () => {
  it("maps to hook_event_name Stop, event_data carries full raw payload", () => {
    const raw = loadFixture("Stop");
    const event = translateStop(raw);

    expect(event).toEqual({
      session_id: raw.conversationId,
      project_name: raw.workspacePaths[0],
      platform: "antigravity",
      hook_event_name: "Stop",
      event_data: raw,
    });
  });
});
