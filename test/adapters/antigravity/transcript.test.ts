import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { readStep, readLatestUserPrompt } from "../../../src/adapters/antigravity/transcript.js";

const transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");

describe("readStep", () => {
  it("returns toolName, args from the PLANNER_RESPONSE and content from the next MODEL entry", async () => {
    // step_index 2 = PLANNER_RESPONSE with run_command tool_call
    // step_index 3 = MODEL RUN_COMMAND with result content
    const result = await readStep(transcriptPath, 2);
    expect(result).toEqual({
      toolName: "run_command",
      args: { CommandLine: "npm test", Cwd: "/workspace/project", WaitMsBeforeAsync: "2000", toolAction: "Running tests", toolSummary: "npm test" },
      result: expect.stringContaining("5 passed"),
    });
  });

  it("returns null when stepIdx is not a PLANNER_RESPONSE (no tool_calls)", async () => {
    const result = await readStep(transcriptPath, 0);
    expect(result).toBeNull();
  });

  it("returns null when stepIdx is not found", async () => {
    const result = await readStep(transcriptPath, 999);
    expect(result).toBeNull();
  });

  it("returns null for a nonexistent file", async () => {
    const result = await readStep("/nonexistent/transcript.jsonl", 0);
    expect(result).toBeNull();
  });
});

describe("readLatestUserPrompt", () => {
  it("returns the most recent user prompt (last USER_EXPLICIT/USER_INPUT entry)", async () => {
    const result = await readLatestUserPrompt(transcriptPath);
    expect(result).toBe("fetch the data again");
  });

  it("returns null for nonexistent file", async () => {
    const result = await readLatestUserPrompt("/nonexistent/transcript.jsonl");
    expect(result).toBeNull();
  });
});
