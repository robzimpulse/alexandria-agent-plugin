import type { CanonicalHookEvent } from "../../core/schema.js";
import { buildEventData } from "../shared/buildEventData.js";

type CodexRawPayload = {
  session_id: string;
  cwd: string;
  hook_event_name: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
};

export function translate(raw: unknown): CanonicalHookEvent {
  const payload = raw as CodexRawPayload;

  const eventDataFields: Record<string, unknown> = {};
  if (payload.hook_event_name === "UserPromptSubmit" && payload.prompt !== undefined) {
    eventDataFields.prompt = payload.prompt;
  }
  if (payload.hook_event_name === "PostToolUse") {
    eventDataFields.tool_name = payload.tool_name ?? null;
    eventDataFields.tool_input = payload.tool_input ?? null;
    eventDataFields.tool_response = payload.tool_response ?? null;
  }

  return {
    session_id: payload.session_id,
    project_name: payload.cwd,
    platform: "codex",
    hook_event_name: payload.hook_event_name,
    event_data: buildEventData(eventDataFields as any),
  };
}
