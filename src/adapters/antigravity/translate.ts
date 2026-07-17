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

function commonMapped(raw: CommonFields): Pick<CanonicalHookEvent, "session_id" | "cwd"> {
  return {
    session_id: raw.conversationId,
    cwd: raw.workspacePaths?.[0] ?? "",
  };
}

export function translatePreToolUse(raw: unknown): CanonicalHookEvent {
  const payload = raw as PreToolUsePayload;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "PreToolUse",
    tool_name: payload.toolCall?.name,
    tool_input: payload.toolCall?.args,
  };
}

export async function translatePostToolUse(raw: unknown): Promise<CanonicalHookEvent> {
  const payload = raw as PostToolUsePayload;
  const event: CanonicalHookEvent = {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "PostToolUse",
  };

  try {
    const content = await fs.readFile(payload.transcriptPath, "utf8");
    const entry = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line))
      .find((line) => line.stepIdx === payload.stepIdx);

    if (entry) {
      event.tool_name = entry.toolName;
      event.tool_input = entry.args;
      event.tool_response = entry.result;
    }
  } catch {
    // Degrade gracefully: never throw on a missing/malformed/unmatched transcript.
  }

  return event;
}

export function translatePreInvocation(raw: unknown): CanonicalHookEvent {
  const payload = raw as PreInvocationPayload;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: payload.invocationNum === 0 ? "SessionStart" : "UserPromptSubmit",
  };
}

export function translateStop(raw: unknown): CanonicalHookEvent {
  const payload = raw as StopPayload;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "Stop",
  };
}
