import type { CanonicalHookEvent } from "../../core/schema.js";
import { promises as fs } from "node:fs";

type CommonFields = {
  conversationId: string;
  workspacePaths: string[];
  transcriptPath: string;
  artifactDirectoryPath: string;
};

type PreToolUsePayload = CommonFields & {
  toolCall?: { name?: string; args?: unknown };
};

type PostToolUsePayload = CommonFields & {
  stepIdx: number;
  error?: string;
};

type PreInvocationPayload = CommonFields & {
  invocationNum: number;
  initialNumSteps: number;
};

type StopPayload = CommonFields & {
  executionNum: number;
  terminationReason: string;
  error?: string;
  fullyIdle: boolean;
};

function commonMapped(raw: CommonFields): Pick<CanonicalHookEvent, "session_id" | "project_name"> {
  return {
    session_id: raw.conversationId,
    project_name: raw.workspacePaths?.[0] ?? "",
  };
}

export function translatePreToolUse(raw: unknown): CanonicalHookEvent {
  const payload = raw as PreToolUsePayload;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "PreToolUse",
    event_data: raw,
  };
}

export async function translatePostToolUse(raw: unknown): Promise<CanonicalHookEvent> {
  const payload = raw as PostToolUsePayload;
  let eventData: unknown = raw;

  try {
    const content = await fs.readFile(payload.transcriptPath, "utf8");
    const entry = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line))
      .find((line) => line.stepIdx === payload.stepIdx);

    if (entry) {
      // Merge transcript-enriched fields into event_data
      eventData = { ...raw, toolName: entry.toolName, args: entry.args, result: entry.result };
    }
  } catch {
    // Degrade gracefully: never throw on a missing/malformed/unmatched transcript.
  }

  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "PostToolUse",
    event_data: eventData,
  };
}

export function translatePreInvocation(raw: unknown): CanonicalHookEvent {
  const payload = raw as PreInvocationPayload;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: payload.invocationNum === 0 ? "SessionStart" : "UserPromptSubmit",
    event_data: raw,
  };
}

export function translateStop(raw: unknown): CanonicalHookEvent {
  const payload = raw as StopPayload;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "Stop",
    event_data: raw,
  };
}
