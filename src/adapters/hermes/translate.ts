import type { CanonicalHookEvent } from "../../core/schema.js";

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

  const event: CanonicalHookEvent = {
    session_id: payload.session_id,
    cwd: payload.cwd,
    platform: "hermes",
    hook_event_name: NATIVE_TO_CANONICAL[payload.hook_event_name] ?? payload.hook_event_name,
  };

  if (payload.hook_event_name === "post_tool_call") {
    event.tool_name = payload.tool_name ?? undefined;
    event.tool_input = payload.tool_input ?? undefined;
    event.tool_response = payload.extra?.result;
  }

  return event;
}
