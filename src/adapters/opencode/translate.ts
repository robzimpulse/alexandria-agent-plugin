import type { CanonicalHookEvent } from "../../core/schema.js";

export interface EventHandlers {
  "session.created": (input: { sessionID: string; projectID: string }) => void;
  "message.updated": (input: { type: string; properties: { info: { role: string; content?: string } } }) => void;
  "tool.execute.after": (input: { tool: string; sessionID: string; callID: string; args: any }, output: { output: string; metadata: any }) => void;
  "session.idle": (input: { type: string; properties: { sessionID: string } }) => void;
  "session.deleted": (input: { type: string; properties: { sessionID: string } }) => void;
}

export function createHandlers(
  sendEvent: (event: CanonicalHookEvent) => void,
  cwd: string,
): EventHandlers {
  return {
    "session.created": (input) => {
      sendEvent({
        session_id: input.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "SessionStart",
        event_data: input,
      });
    },
    "message.updated": (input) => {
      if (input.properties?.info?.role !== "user") return;
      sendEvent({
        session_id: "",
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "UserPromptSubmit",
        event_data: input,
      });
    },
    "tool.execute.after": (input, output) => {
      sendEvent({
        session_id: input.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "PostToolUse",
        event_data: { input, output },
      });
    },
    "session.idle": (input) => {
      sendEvent({
        session_id: input.properties.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "SessionEnd",
        event_data: input,
      });
    },
    "session.deleted": (input) => {
      sendEvent({
        session_id: input.properties.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "SessionEnd",
        event_data: input,
      });
    },
  };
}
