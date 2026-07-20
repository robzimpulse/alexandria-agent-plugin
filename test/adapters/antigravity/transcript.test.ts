import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { readStep, readLatestUserPrompt } from "../../../src/adapters/antigravity/transcript.js";

const transcriptPath = path.join(process.cwd(), "test/fixtures/antigravity/transcript.jsonl");

describe("readStep", () => {
  it("finds and returns the correct step entry by stepIdx", async () => {
    const result = await readStep(transcriptPath, 19);
    expect(result).toEqual({
      toolName: "run_command",
      args: { CommandLine: "npm test" },
      result: { stdout: "5 passed", exitCode: 0 },
    });
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
  it("returns null (Antigravity transcript has no user prompt entries)", async () => {
    const result = await readLatestUserPrompt(transcriptPath);
    expect(result).toBeNull();
  });

  it("returns null for nonexistent file", async () => {
    const result = await readLatestUserPrompt("/nonexistent/transcript.jsonl");
    expect(result).toBeNull();
  });
});
