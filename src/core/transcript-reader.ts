import * as fs from "node:fs";
import { readLatestUserPrompt as readAntigravityPrompt, readStep as readAntigravityStep } from "../adapters/antigravity/transcript.js";

export type JsonlPlatform = 'claude-code' | 'codex' | 'cursor' | 'antigravity';

interface TranscriptEntry {
  type?: string;
  role?: string;
  source?: string;
  payload?: {
    type?: string;
    role?: string;
    content?: string | Array<{ type: string; text: string }>;
    message?: string;
  };
  message?: { content?: string | Array<{ type: string; text: string }> };
  content?: string | Array<{ type: string; text: string }>;
}

export function detectPlatform(line: string): JsonlPlatform | null {
  try {
    const entry = JSON.parse(line) as TranscriptEntry;
    if (entry.source) return 'antigravity';
    if (entry.type === 'user' || entry.type === 'assistant') return 'claude-code';
    if (entry.role === 'user' || entry.role === 'assistant') return 'codex';
    // Codex wraps messages in payload envelope
    if (entry.payload?.role === 'user' || entry.payload?.role === 'assistant') return 'codex';
    const codexLineTypes: string[] = ['response_item', 'event_msg', 'session_meta', 'world_state', 'turn_context'];
    if (codexLineTypes.includes(entry.type ?? '')) return 'codex';
    return null;
  } catch {
    return null;
  }
}

function extractFromContentArray(
  content: string | Array<{ type: string; text: string }>
): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const texts = content
      .filter(c => c.type === 'input_text' || c.type === 'text')
      .map(c => c.text)
      .filter(Boolean);
    return texts.length > 0 ? texts.join('\n') : null;
  }
  return null;
}

function extractUserText(entry: TranscriptEntry): string | null {
  // Claude Code: {type:"user", message:{content:"text"}}
  if (entry.type === 'user' && entry.message && typeof entry.message.content === 'string') {
    return entry.message.content;
  }
  // Codex event_msg user_message: {type:"event_msg", payload:{type:"user_message", message:"text"}}
  if (entry.type === 'event_msg' && entry.payload?.type === 'user_message' && typeof entry.payload.message === 'string') {
    return entry.payload.message;
  }
  // Codex response_item user: {type:"response_item", payload:{role:"user", content:[...]}}
  if (entry.payload?.role === 'user' && entry.payload?.content) {
    return extractFromContentArray(entry.payload.content);
  }
  // Codex flat: {role:"user", content:"text"}
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