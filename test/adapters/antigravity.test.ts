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
  it("maps toolCall.name/args to tool_name/tool_input, omits tool_response", () => {
    const raw = loadFixture("PreToolUse");

    const event = translatePreToolUse(raw);

    expect(event).toEqual({
      session_id: raw.conversationId,
      cwd: raw.workspacePaths[0],
      platform: "antigravity",
      hook_event_name: "PreToolUse",
      tool_name: raw.toolCall.name,
      tool_input: raw.toolCall.args,
    });
  });

  it("never throws on a malformed payload (missing toolCall)", () => {
    const event = translatePreToolUse({ conversationId: "c1", workspacePaths: ["/tmp"] });

    expect(event.tool_name).toBeUndefined();
    expect(event.tool_input).toBeUndefined();
  });

  it("falls back to an empty cwd when workspacePaths is empty", () => {
    const event = translatePreToolUse({ conversationId: "c1", workspacePaths: [], toolCall: { name: "x", args: {} } });

    expect(event.cwd).toBe("");
  });
});

describe("antigravity translatePostToolUse", () => {
  it("parses transcript.jsonl and extracts the entry matching stepIdx", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");

    const event = await translatePostToolUse(raw);

    expect(event).toEqual({
      session_id: raw.conversationId,
      cwd: raw.workspacePaths[0],
      platform: "antigravity",
      hook_event_name: "PostToolUse",
      tool_name: "run_command",
      tool_input: { CommandLine: "npm test" },
      tool_response: { stdout: "5 passed", exitCode: 0 },
    });
  });

  it("degrades gracefully when the transcript file doesn't exist, rather than throwing", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = "/nonexistent/path/transcript.jsonl";

    const event = await translatePostToolUse(raw);

    expect(event.hook_event_name).toBe("PostToolUse");
    expect(event.tool_name).toBeUndefined();
    expect(event.tool_input).toBeUndefined();
    expect(event.tool_response).toBeUndefined();
  });

  it("degrades gracefully when no entry in the transcript matches stepIdx", async () => {
    const raw = loadFixture("PostToolUse");
    raw.transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");
    raw.stepIdx = 999;

    const event = await translatePostToolUse(raw);

    expect(event.tool_name).toBeUndefined();
    expect(event.tool_response).toBeUndefined();
  });
});

describe("antigravity translatePreInvocation", () => {
  it("maps invocationNum 0 to SessionStart", () => {
    const raw = loadFixture("PreInvocation-SessionStart");

    const event = translatePreInvocation(raw);

    expect(event).toEqual({
      session_id: raw.conversationId,
      cwd: raw.workspacePaths[0],
      platform: "antigravity",
      hook_event_name: "SessionStart",
    });
  });

  it("maps a non-zero invocationNum to UserPromptSubmit", () => {
    const raw = loadFixture("PreInvocation-UserPromptSubmit");

    const event = translatePreInvocation(raw);

    expect(event.hook_event_name).toBe("UserPromptSubmit");
    expect(event.tool_name).toBeUndefined();
    expect(event.tool_input).toBeUndefined();
    expect(event.tool_response).toBeUndefined();
  });
});

describe("antigravity translateStop", () => {
  it("maps to hook_event_name Stop, omitting tool fields", () => {
    const raw = loadFixture("Stop");

    const event = translateStop(raw);

    expect(event).toEqual({
      session_id: raw.conversationId,
      cwd: raw.workspacePaths[0],
      platform: "antigravity",
      hook_event_name: "Stop",
    });
  });
});
