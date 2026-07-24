import type { CanonicalHookEvent } from "../../core/schema.js";
import { buildEventData } from "../shared/buildEventData.js";
import { readLatestUserMessage } from "../../core/transcript-reader.js";

type CursorRawPayload = {
  conversation_id: string;
  workspace_roots?: string[];
  hook_event_name: string;
  tool_name?: string;
  file_path?: string;
  edits?: unknown[];
  result_json?: string;
  prompt?: string;
  transcript_path?: string;
};

export async function translate(raw: unknown): Promise<CanonicalHookEvent> {
  const payload = raw as CursorRawPayload;
  const cwd = payload.workspace_roots?.[0] ?? process.cwd();
  const sessionId = payload.conversation_id;

  const eventDataFields: Record<string, unknown> = {};

  if (payload.hook_event_name === "UserPromptSubmit") {
    if (payload.prompt !== undefined) {
      eventDataFields.prompt = payload.prompt;
    } else if (payload.transcript_path) {
      eventDataFields.prompt = await readLatestUserMessage(
        payload.transcript_path,
        "cursor"
      );
    }
  }

  if (payload.hook_event_name === "PostToolUse") {
    // Cursor puts file_path and edits at top level, not in tool_input
    eventDataFields.tool_name = payload.tool_name ?? null;
    eventDataFields.tool_input = {
      ...(payload.file_path ? { filePath: payload.file_path } : {}),
      ...(payload.edits ? { edits: payload.edits } : {}),
    };
    eventDataFields.tool_response = payload.result_json ?? null;
  }

  return {
    session_id: sessionId,
    project_name: cwd,
    platform: "cursor",
    hook_event_name: payload.hook_event_name,
    event_data: buildEventData(eventDataFields as any),
  };
}