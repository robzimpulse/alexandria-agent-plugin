export type CanonicalHookEvent = {
  session_id: string;
  project_name: string;
  platform: string;
  hook_event_name: string;
  event_data: unknown;
};
