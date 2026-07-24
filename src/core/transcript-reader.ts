import * as fs from "node:fs";
import { readLatestUserPrompt as readAntigravityPrompt, readStep as readAntigravityStep } from "../adapters/antigravity/transcript.js";

export type JsonlPlatform = 'claude-code' | 'codex' | 'cursor' | 'antigravity';

interface TranscriptEntry {
  type?: string;
  role?: string;
  source?: string;
  message?: { content?: string | Array<{ type: string; text: string }> };
  content?: string | Array<{ type: string; text: string }>;
}

export function detectPlatform(line: string): JsonlPlatform | null {
  try {
    const entry = JSON.parse(line) as TranscriptEntry;
    if (entry.source) return 'antigravity';
    if (entry.type === 'user' || entry.type === 'assistant') return 'claude-code';
    if (entry.role === 'user' || entry.role === 'assistant') return 'codex';  // cursor also uses 'role'
    return null;
  } catch {
    return null;
  }
}

function extractUserText(entry: TranscriptEntry): string | null {
  // Claude Code: {type:"user", message:{content:"text"}}
  if (entry.type === 'user' && entry.message && typeof entry.message.content === 'string') {
    return entry.message.content;
  }
  // Codex: {role:"user", content:"text"}
  if (entry.role === 'user' && typeof entry.content === 'string') {
    return entry.content;
  }
  // Cursor: {role:"user", message:{content:"text"}}
  if (entry.role === 'user' && entry.message && typeof entry.message.content === 'string') {
    return entry.message.content;
  }
  return null;
}

export async function readLatestUserMessage(
  transcriptPath: string,
  platform?: JsonlPlatform
): Promise<string | null> {
  try {
    const content = await fs.promises.readFile(transcriptPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;

    // Detect platform from first valid line if not provided
    const resolvedPlatform = platform ?? detectPlatform(lines[0]);
    if (!resolvedPlatform) return null;

    if (resolvedPlatform === 'antigravity') {
      return readAntigravityPrompt(transcriptPath);
    }

    // Walk backwards looking for the most recent user message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as TranscriptEntry;
        const text = extractUserText(entry);
        if (text) return text;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function readToolCallByIndex(
  transcriptPath: string,
  platform: JsonlPlatform,
  stepIndex: number
): Promise<{ toolName: string; args: unknown; result: unknown } | null> {
  if (platform !== 'antigravity') return null;
  return readAntigravityStep(transcriptPath, stepIndex);
}