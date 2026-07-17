import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../src/adapters/hermes/translate.js";

function loadFixture(name: string): Record<string, any> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "test/fixtures/hermes", `${name}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

describe("hermes translate", () => {
  it("maps post_tool_call: tool_name/tool_input pass through, tool_response comes from extra.result", () => {
    const raw = loadFixture("post_tool_call");

    const event = translate(raw);

    expect(event).toEqual({
      session_id: raw.session_id,
      cwd: raw.cwd,
      platform: "hermes",
      hook_event_name: "post_tool_call",
      tool_name: raw.tool_name,
      tool_input: raw.tool_input,
      tool_response: raw.extra.result,
    });
  });

  for (const eventName of ["on_session_start", "pre_llm_call", "post_llm_call", "on_session_end"]) {
    it(`maps ${eventName}: tool_name/tool_input/tool_response all absent despite null in the raw payload`, () => {
      const raw = loadFixture(eventName);

      const event = translate(raw);

      expect(event).toEqual({
        session_id: raw.session_id,
        cwd: raw.cwd,
        platform: "hermes",
        hook_event_name: eventName,
      });
      expect(event.tool_name).toBeUndefined();
      expect(event.tool_input).toBeUndefined();
      expect(event.tool_response).toBeUndefined();
    });
  }

  it("degrades gracefully when extra.result is missing on post_tool_call, rather than throwing", () => {
    const raw = {
      hook_event_name: "post_tool_call",
      tool_name: "terminal",
      tool_input: { command: "npm test" },
      session_id: "sess-abc123",
      cwd: "/home/user/project",
      extra: {},
    };

    const event = translate(raw);

    expect(event.tool_name).toBe("terminal");
    expect(event.tool_input).toEqual({ command: "npm test" });
    expect(event.tool_response).toBeUndefined();
  });
});
