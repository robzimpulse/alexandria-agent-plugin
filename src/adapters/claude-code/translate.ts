import type { CanonicalHookEvent } from "../../core/schema.js";

type ClaudeCodeRawPayload = {
  session_id: string;
  cwd: string;
  hook_event_name: string;
  transcript_path?: string;
  permission_mode?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
};

export function translate(raw: unknown): CanonicalHookEvent {
  const payload = raw as ClaudeCodeRawPayload;

  const event: CanonicalHookEvent = {
    session_id: payload.session_id,
    cwd: payload.cwd,
    platform: "claude-code",
    hook_event_name: payload.hook_event_name,
  };

  if (payload.hook_event_name === "PostToolUse") {
    event.tool_name = payload.tool_name;
    event.tool_input = payload.tool_input;
    event.tool_response = payload.tool_response;
  }

  return event;
}
