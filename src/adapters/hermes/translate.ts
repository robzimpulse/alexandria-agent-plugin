import type { CanonicalHookEvent } from "../../core/schema.js";
import { buildEventData } from "../shared/buildEventData.js";

type HermesRawPayload = {
  hook_event_name: string;
  session_id: string;
  cwd: string;
  tool_name: string | null;
  tool_input: unknown | null;
  extra?: Record<string, unknown>;
};

const NATIVE_TO_CANONICAL: Record<string, string> = {
  on_session_start: "SessionStart",
  on_session_reset: "SessionStart",
  pre_llm_call: "UserPromptSubmit",
  post_tool_call: "PostToolUse",
  post_llm_call: "Stop",
  on_session_end: "SessionEnd",
};

export function translate(raw: unknown): CanonicalHookEvent {
  const payload = raw as HermesRawPayload;

  return {
    session_id: payload.session_id,
    project_name: payload.cwd,
    platform: "hermes",
    hook_event_name: NATIVE_TO_CANONICAL[payload.hook_event_name] ?? payload.hook_event_name,
    event_data: buildEventData(
      hookNameToEventData(payload.hook_event_name, payload)
    ),
  };
}

function hookNameToEventData(
  nativeHook: string,
  payload: HermesRawPayload,
): Partial<import("../../core/schema.js").EventData> {
  switch (nativeHook) {
    case "pre_llm_call":
      return { prompt: (payload.extra?.user_message as string) ?? null };
    case "post_tool_call":
      return {
        tool_name: payload.tool_name,
        tool_input: payload.tool_input,
        tool_response: (payload.extra?.result as string) ?? null,
      };
    default:
      // SessionStart, Stop, SessionEnd — all fields stay null (signal-only)
      return {};
  }
}
