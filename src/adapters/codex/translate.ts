import type { CanonicalHookEvent } from "../../core/schema.js";

type CodexRawPayload = {
  session_id: string;
  cwd: string;
  hook_event_name: string;
};

export function translate(raw: unknown): CanonicalHookEvent {
  const payload = raw as CodexRawPayload;

  return {
    session_id: payload.session_id,
    project_name: payload.cwd,
    platform: "codex",
    hook_event_name: payload.hook_event_name,
    event_data: raw,
  };
}
