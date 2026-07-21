import { promises as fs } from "node:fs";

type TranscriptEntry = {
  step_index: number;
  source: string;
  type: string;
  status: string;
  created_at: string;
  content?: string;
  tool_calls?: { name: string; args: Record<string, unknown> }[];
  error?: string;
};

/**
 * Extract the user prompt from a USER_EXPLICIT/USER_INPUT transcript entry.
 * Prompts live inside <USER_REQUEST>...</USER_REQUEST> tags in the content.
 */
function extractUserPrompt(entry: TranscriptEntry): string | null {
  if (!entry.content) return null;
  const match = entry.content.match(
    /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/,
  );
  return match ? match[1].trim() : null;
}

/**
 * Read the most recent user prompt from the Antigravity JSONL transcript.
 * Walks backwards through entries to find the last USER_EXPLICIT / USER_INPUT
 * entry whose content contains a `<USER_REQUEST>` tag.
 */
export async function readLatestUserPrompt(
  transcriptPath: string,
): Promise<string | null> {
  try {
    const content = await fs.readFile(transcriptPath, "utf8");
    const lines = content
      .split("\n")
      .filter((l) => l.trim().length > 0);

    // Walk backwards — the last user message is the latest turn's prompt.
    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = JSON.parse(lines[i]) as TranscriptEntry;
      if (
        (entry.source === "USER_EXPLICIT" || entry.source === "USER") &&
        entry.type === "USER_INPUT"
      ) {
        const prompt = extractUserPrompt(entry);
        if (prompt) return prompt;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Read a specific tool call from the Antigravity JSONL transcript by step index.
 *
 * In the real Antigravity format:
 * - The tool *plan* entry (PLANNER_RESPONSE) contains `tool_calls[].name` and
 *   `tool_calls[].args` at `step_index`.
 * - The tool *result* entry (MODEL, type=RUN_COMMAND / CODE_ACTION etc.) is
 *   the next consecutive MODEL entry with a matching type, at `step_index + 1`.
 *
 * Returns `null` if the step index isn't a PLANNER_RESPONSE with tool_calls.
 */
export async function readStep(
  transcriptPath: string,
  stepIdx: number,
): Promise<{ toolName: string; args: unknown; result: unknown } | null> {
  try {
    const content = await fs.readFile(transcriptPath, "utf8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TranscriptEntry);

    // Find the planner / tool-call entry at the requested step index.
    const planEntry = lines.find(
      (e) => e.step_index === stepIdx && e.tool_calls && e.tool_calls.length > 0,
    );
    if (!planEntry || !planEntry.tool_calls) return null;

    const toolCall = planEntry.tool_calls[0];

    // The result entry is at step_index + 1 (consecutive in the transcript).
    const resultEntry = lines.find(
      (e) => e.step_index === stepIdx + 1 && e.source === "MODEL" && e.content,
    );

    return {
      toolName: toolCall.name,
      args: toolCall.args,
      result: resultEntry?.content ?? null,
    };
  } catch {
    return null;
  }
}
