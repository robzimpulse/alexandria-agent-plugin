import type { CanonicalHookEvent } from "../../core/schema.js";

type HermesRawPayload = {
  hook_event_name: string;
  session_id: string;
  cwd: string;
  tool_name: string | null;
  tool_input: unknown | null;
  extra?: Record<string, unknown>;
};

export function translate(raw: unknown): CanonicalHookEvent {
  const payload = raw as HermesRawPayload;

  const event: CanonicalHookEvent = {
    session_id: payload.session_id,
    cwd: payload.cwd,
    platform: "hermes",
    hook_event_name: payload.hook_event_name,
  };

  if (payload.hook_event_name === "post_tool_call") {
    event.tool_name = payload.tool_name ?? undefined;
    event.tool_input = payload.tool_input ?? undefined;
    event.tool_response = payload.extra?.result;
  }

  return event;
}
