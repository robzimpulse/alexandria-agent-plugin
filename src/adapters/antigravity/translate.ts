import type { CanonicalHookEvent } from "../../core/schema.js";
import { buildEventData } from "../shared/buildEventData.js";
import { readStep, readLatestUserPrompt } from "./transcript.js";

type CommonFields = {
  conversationId: string;
  workspacePaths: string[];
  transcriptPath: string;
  artifactDirectoryPath: string;
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

// translatePreToolUse removed — PreToolUse is not in the canonical event set.

export async function translatePostToolUse(raw: unknown): Promise<CanonicalHookEvent> {
  const payload = raw as PostToolUsePayload;
  let toolName: string | null = null;
  let toolInput: unknown = null;
  let toolResponse: unknown = null;

  try {
    const entry = await readStep(payload.transcriptPath, payload.stepIdx);
    if (entry) {
      toolName = entry.toolName;
      toolInput = entry.args;
      toolResponse = entry.result;
    }
  } catch {
    // Degrade gracefully.
  }

  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "PostToolUse",
    event_data: buildEventData({
      tool_name: toolName,
      tool_input: toolInput,
      tool_response: toolResponse,
    }),
  };
}

export async function translatePreInvocation(raw: unknown): Promise<CanonicalHookEvent> {
  const payload = raw as PreInvocationPayload;
  const isSessionStart = payload.invocationNum === 0;

  let prompt: string | null = null;
  if (!isSessionStart) {
    // Antigravity transcript doesn't store user prompts; gracefully return null.
    prompt = await readLatestUserPrompt(payload.transcriptPath);
  }

  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: isSessionStart ? "SessionStart" : "UserPromptSubmit",
    event_data: buildEventData({ prompt }),
  };
}

export function translateStop(raw: unknown): CanonicalHookEvent {
  const payload = raw as StopPayload;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "Stop",
    event_data: buildEventData(), // signal-only, all null
  };
}
