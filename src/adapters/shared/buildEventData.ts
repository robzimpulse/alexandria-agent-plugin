import type { EventData } from "../../core/schema.js";

export function buildEventData(overrides: Partial<EventData> = {}): EventData {
  return {
    prompt: null,
    tool_name: null,
    tool_input: null,
    tool_response: null,
    ...overrides,
  };
}
