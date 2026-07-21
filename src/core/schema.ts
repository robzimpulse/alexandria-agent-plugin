export type EventData = {
  prompt: string | null;
  tool_name: string | null;
  tool_input: unknown | null;
  tool_response: unknown | null;
};

export type CanonicalHookEvent = {
  session_id: string;
  project_name: string;
  platform: string;
  hook_event_name: string;
  event_data: EventData;
};
