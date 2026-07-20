import { promises as fs } from "node:fs";

type TranscriptEntry = {
  stepIdx: number;
  toolName: string;
  args: unknown;
  result: unknown;
};

export async function readLatestUserPrompt(
  transcriptPath: string,
): Promise<string | null> {
  try {
    const content = await fs.readFile(transcriptPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    // Walk backwards — Antigravity transcript stores entries chronologically;
    // the last "user message" entry is the latest turn's prompt.
    // Antigravity doesn't store user messages as transcript entries.
    // Instead, the prompt is not recorded in the step-based JSONL format.
    // Return null so the field stays null for Antigravity UserPromptSubmit.
    return null;
  } catch {
    return null;
  }
}

export async function readStep(
  transcriptPath: string,
  stepIdx: number,
): Promise<{ toolName: string; args: unknown; result: unknown } | null> {
  try {
    const content = await fs.readFile(transcriptPath, "utf8");
    const entry = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TranscriptEntry)
      .find((line) => line.stepIdx === stepIdx);

    if (!entry) return null;
    return {
      toolName: entry.toolName,
      args: entry.args,
      result: entry.result,
    };
  } catch {
    return null;
  }
}
