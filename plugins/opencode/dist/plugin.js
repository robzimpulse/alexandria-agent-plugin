// src/core/client.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
async function sendEvent(event, config, deps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const logDir = deps.logDir ?? path.join(os.homedir(), ".alexandria");
  const timeoutMs = deps.timeoutMs ?? 3e3;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    let response;
    try {
      response = await fetchFn(`${config.url}/api/hooks`, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new Error(`POST /api/hooks failed with status ${response.status}`);
    }
    logOutcome(event, "SUCCESS", logDir);
  } catch (err) {
    logOutcome(event, "FAIL", logDir, err);
  }
}
function logOutcome(event, status, logDir, err) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const line = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      platform: event.platform,
      hook_event_name: event.hook_event_name,
      status
    };
    if (err !== void 0) {
      line.error = err instanceof Error ? err.message : String(err);
    }
    fs.appendFileSync(path.join(logDir, "plugin.log"), JSON.stringify(line) + "\n");
  } catch {
  }
}

// src/core/config.ts
import * as fs2 from "node:fs";
import * as os2 from "node:os";
import * as path2 from "node:path";
function loadConfig(configDir = path2.join(os2.homedir(), ".alexandria"), env = process.env) {
  let fileConfig = {};
  try {
    const raw = fs2.readFileSync(path2.join(configDir, "config.json"), "utf8");
    fileConfig = JSON.parse(raw);
  } catch {
    fileConfig = {};
  }
  const url = env.ALEXANDRIA_URL ?? fileConfig.url ?? "";
  const apiKey = env.ALEXANDRIA_API_KEY ?? fileConfig.apiKey;
  return apiKey ? { url, apiKey } : { url };
}

// src/adapters/shared/buildEventData.ts
function buildEventData(overrides = {}) {
  return {
    prompt: null,
    tool_name: null,
    tool_input: null,
    tool_response: null,
    ...overrides
  };
}

// src/adapters/opencode/translate.ts
function createHandlers(sendEvent2, cwd) {
  return {
    "session.created": (input) => {
      sendEvent2({
        session_id: input.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "SessionStart",
        event_data: buildEventData()
        // signal-only, all null
      });
    },
    "message.updated": (input) => {
      if (input.properties?.info?.role !== "user") return;
      sendEvent2({
        session_id: "",
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "UserPromptSubmit",
        event_data: buildEventData({
          prompt: input.properties.info.content ?? null
        })
      });
    },
    "tool.execute.after": (input, output) => {
      sendEvent2({
        session_id: input.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "PostToolUse",
        event_data: buildEventData({
          tool_name: input.tool,
          tool_input: input.args,
          tool_response: output.output
        })
      });
    },
    "session.idle": (input) => {
      sendEvent2({
        session_id: input.properties.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "SessionEnd",
        event_data: buildEventData()
        // signal-only, all null
      });
    },
    "session.deleted": (input) => {
      sendEvent2({
        session_id: input.properties.sessionID,
        project_name: cwd,
        platform: "opencode",
        hook_event_name: "SessionEnd",
        event_data: buildEventData()
        // signal-only, all null
      });
    }
  };
}

// src/adapters/opencode/plugin.ts
var AlexandriaCapture = async (ctx) => {
  const cwd = ctx.worktree || ctx.directory;
  const config = loadConfig();
  const handlers = createHandlers(
    (event) => sendEvent(event, config),
    cwd
  );
  return {
    "event": async (input) => {
      const e = input.event;
      switch (e.type) {
        case "session.created":
          await handlers["session.created"](e);
          break;
        case "message.updated":
          await handlers["message.updated"](e);
          break;
        case "session.idle":
          await handlers["session.idle"](e);
          break;
        case "session.deleted":
          await handlers["session.deleted"](e);
          break;
      }
    },
    "tool.execute.after": async (input, output) => {
      await handlers["tool.execute.after"](input, output);
    }
  };
};
export {
  AlexandriaCapture
};
