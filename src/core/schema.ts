export type CanonicalHookEvent = {
  session_id: string;
  cwd: string;
  platform: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
};
