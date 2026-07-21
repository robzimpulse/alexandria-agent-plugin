"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/core/client.ts
var fs = __toESM(require("node:fs"), 1);
var os = __toESM(require("node:os"), 1);
var path = __toESM(require("node:path"), 1);
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
    const logsDir = path.join(logDir, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const platformLog = path.join(logsDir, `${event.platform}.log`);
    const dataLine = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      session_id: event.session_id,
      project_name: event.project_name,
      platform: event.platform,
      hook_event_name: event.hook_event_name,
      event_data: event.event_data
    };
    if (err !== void 0) {
      dataLine.error = err instanceof Error ? err.message : String(err);
    }
    fs.appendFileSync(platformLog, JSON.stringify(dataLine) + "\n");
  } catch {
  }
}

// src/core/config.ts
var fs2 = __toESM(require("node:fs"), 1);
var os2 = __toESM(require("node:os"), 1);
var path2 = __toESM(require("node:path"), 1);
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

// src/core/runner.ts
var import_node_child_process = require("node:child_process");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_node_fs = require("node:fs");
var HERMES_HOME = (0, import_node_path.normalize)((0, import_node_path.join)((0, import_node_os.homedir)(), ".hermes"));
var STATE_DB = (0, import_node_path.join)(HERMES_HOME, "state.db");
function resolveProjectPath(cwd) {
  try {
    return (0, import_node_child_process.execSync)("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf8",
      timeout: 3e3,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return cwd;
  }
}
function resolveProjectName(session_id, cwd) {
  if (session_id && (0, import_node_fs.existsSync)(STATE_DB)) {
    try {
      const rows = (0, import_node_child_process.execSync)(
        `sqlite3 "${STATE_DB}" "SELECT git_repo_root, cwd FROM sessions WHERE id='${session_id.replace(/'/g, "''")}'"`,
        { encoding: "utf8", timeout: 3e3, stdio: ["ignore", "pipe", "ignore"] }
      ).trim().split("|");
      if (rows.length >= 2) {
        const gitRoot2 = rows[0];
        const dbCwd = rows[1];
        const root = gitRoot2 ? gitRoot2 : dbCwd ? resolveProjectPath(dbCwd) : "";
        if (root) return (0, import_node_path.basename)(root);
      }
    } catch {
    }
  }
  const gitRoot = resolveProjectPath(cwd);
  if (gitRoot) return (0, import_node_path.basename)(gitRoot);
  if (cwd) return (0, import_node_path.basename)(cwd);
  return "General";
}
var defaultIO = {
  readStdin: () => new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  }),
  writeStdout: (text) => {
    process.stdout.write(text);
  },
  exit: (code) => {
    process.exit(code);
  }
};
async function runStdioHook(translate, stdout = "{}", io = defaultIO) {
  try {
    const raw = JSON.parse(await io.readStdin());
    const event = await translate(raw);
    event.project_name = resolveProjectName(event.session_id, event.project_name);
    await sendEvent(event, loadConfig());
  } catch {
  }
  io.writeStdout(stdout);
  io.exit(0);
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

// src/adapters/antigravity/transcript.ts
var import_node_fs2 = require("node:fs");
function extractUserPrompt(entry) {
  if (!entry.content) return null;
  const match = entry.content.match(
    /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/
  );
  return match ? match[1].trim() : null;
}
async function readLatestUserPrompt(transcriptPath) {
  try {
    const content = await import_node_fs2.promises.readFile(transcriptPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = JSON.parse(lines[i]);
      if ((entry.source === "USER_EXPLICIT" || entry.source === "USER") && entry.type === "USER_INPUT") {
        const prompt = extractUserPrompt(entry);
        if (prompt) return prompt;
      }
    }
    return null;
  } catch {
    return null;
  }
}
async function readStep(transcriptPath, stepIdx) {
  try {
    const content = await import_node_fs2.promises.readFile(transcriptPath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
    const planEntry = lines.find(
      (e) => e.step_index === stepIdx && e.tool_calls && e.tool_calls.length > 0
    );
    if (!planEntry || !planEntry.tool_calls) return null;
    const toolCall = planEntry.tool_calls[0];
    const resultEntry = lines.find(
      (e) => e.step_index === stepIdx + 1 && e.source === "MODEL" && e.content
    );
    return {
      toolName: toolCall.name,
      args: toolCall.args,
      result: resultEntry?.content ?? null
    };
  } catch {
    return null;
  }
}

// src/adapters/antigravity/translate.ts
function commonMapped(raw) {
  return {
    session_id: raw.conversationId,
    project_name: raw.workspacePaths?.[0] ?? ""
  };
}
async function translatePostToolUse(raw) {
  const payload = raw;
  let toolName = null;
  let toolInput = null;
  let toolResponse = null;
  try {
    const entry = await readStep(payload.transcriptPath, payload.stepIdx);
    if (entry) {
      toolName = entry.toolName;
      toolInput = entry.args;
      toolResponse = entry.result;
    }
  } catch {
  }
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "PostToolUse",
    event_data: buildEventData({
      tool_name: toolName,
      tool_input: toolInput,
      tool_response: toolResponse
    })
  };
}
async function translatePreInvocation(raw) {
  const payload = raw;
  const isSessionStart = payload.invocationNum === 0;
  let prompt = null;
  if (!isSessionStart) {
    prompt = await readLatestUserPrompt(payload.transcriptPath);
  }
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: isSessionStart ? "SessionStart" : "UserPromptSubmit",
    event_data: buildEventData({ prompt })
  };
}
function translateStop(raw) {
  const payload = raw;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "Stop",
    event_data: buildEventData()
    // signal-only, all null
  };
}

// src/adapters/antigravity/cli.ts
var mode = process.argv[2];
switch (mode) {
  case "pre":
    break;
  case "post":
    runStdioHook(translatePostToolUse, "{}");
    break;
  case "preinvocation":
    runStdioHook(translatePreInvocation, "{}");
    break;
  case "stop":
    runStdioHook(translateStop, '{"decision":""}');
    break;
}
