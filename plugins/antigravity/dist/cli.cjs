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

// src/core/context-store.ts
var fs = __toESM(require("node:fs"), 1);
var os = __toESM(require("node:os"), 1);
var path = __toESM(require("node:path"), 1);
var LOG_DIR = path.join(os.homedir(), ".alexandria");
var LOG_FILE = path.join(LOG_DIR, "context.log");
function logEntry(entry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), ...entry }) + "\n"
    );
  } catch {
  }
}
var OBS_TYPE_LABELS = {
  bugfix: "[BUGFIX]",
  feature: "[FEATURE]",
  refactor: "[REFACTOR]",
  change: "[CHANGE]",
  discovery: "[DISCOVERY]",
  decision: "[DECISION]",
  learning: "[LEARNING]"
};
var ContextStore = class {
  sessions = /* @__PURE__ */ new Map();
  initState() {
    return {
      observations: [],
      lastSummary: null,
      recentPrompts: [],
      lastObservationId: 0
    };
  }
  /**
   * Fetch incremental context from the server, merge into the session's store,
   * and return the full rendered markdown for hookSpecificOutput.
   * Returns null on failure or empty response.
   */
  async refresh(configUrl, apiKey, sessionId, projects, platform) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, this.initState());
    }
    const state = this.sessions.get(sessionId);
    const sinceId = state.lastObservationId;
    logEntry({ session_id: sessionId, event: "refresh", projects, since: sinceId });
    const resp = await fetch(`${configUrl}/api/context-since`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      },
      body: JSON.stringify({
        projects,
        platform,
        since_observation_id: sinceId
      }),
      signal: AbortSignal.timeout(3e3)
    });
    if (!resp.ok) {
      logEntry({ session_id: sessionId, event: "fetch_failed", status: resp.status });
      return null;
    }
    const data = await resp.json();
    if (state.lastObservationId === 0) {
      logEntry({
        session_id: sessionId,
        event: "full_fetch",
        observation_count: data.observations.length,
        has_summary: !!data.last_summary,
        prompt_count: data.recent_prompts.length,
        new_since: data.new_since_id
      });
      state.observations = data.observations;
      state.lastSummary = data.last_summary;
      state.recentPrompts = data.recent_prompts;
    } else {
      if (data.observations.length > 0) {
        logEntry({
          session_id: sessionId,
          event: "incremental",
          new_observations: data.observations.length,
          new_since: data.new_since_id
        });
        state.observations.push(...data.observations);
      }
      if (data.last_summary) state.lastSummary = data.last_summary;
      if (data.recent_prompts.length > 0) {
        const existing = new Set(state.recentPrompts);
        for (const p of data.recent_prompts) {
          if (!existing.has(p)) state.recentPrompts.push(p);
        }
      }
    }
    state.lastObservationId = data.new_since_id;
    return this.renderMarkdown(state);
  }
  renderMarkdown(state) {
    const parts = [];
    const byDate = /* @__PURE__ */ new Map();
    for (const obs of state.observations) {
      const date = obs.created_at.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(obs);
    }
    parts.push("<alexandria-context>");
    for (const [date, obsList] of byDate) {
      parts.push(`### ${date}`);
      const byFile = /* @__PURE__ */ new Map();
      for (const obs of obsList) {
        const file = obs.files_modified?.[0] || obs.files_read?.[0] || "General";
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file).push(obs);
      }
      for (const [file, fileObs] of byFile) {
        parts.push(`**${file}**`);
        for (const obs of fileObs) {
          const label = OBS_TYPE_LABELS[obs.type] || "[OBS]";
          parts.push(`  ${label} ${obs.title}: ${obs.narrative}`);
        }
      }
    }
    if (state.recentPrompts.length > 0) {
      parts.push("");
      parts.push("<recent-prompts>");
      for (const p of state.recentPrompts.slice(0, 3)) {
        parts.push(`- ${p}`);
      }
      parts.push("</recent-prompts>");
    }
    if (state.lastSummary) {
      parts.push("");
      parts.push("<last-summary>");
      parts.push(state.lastSummary);
      parts.push("</last-summary>");
    }
    parts.push("</alexandria-context>");
    return parts.join("\n");
  }
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }
  clearAll() {
    this.sessions.clear();
  }
};

// src/core/client.ts
var fs2 = __toESM(require("node:fs"), 1);
var os2 = __toESM(require("node:os"), 1);
var path2 = __toESM(require("node:path"), 1);
async function sendEvent(event, config, deps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const logDir = deps.logDir ?? path2.join(os2.homedir(), ".alexandria");
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
    fs2.mkdirSync(logDir, { recursive: true });
    const line = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      platform: event.platform,
      hook_event_name: event.hook_event_name,
      status
    };
    if (err !== void 0) {
      line.error = err instanceof Error ? err.message : String(err);
    }
    fs2.appendFileSync(path2.join(logDir, "plugin.log"), JSON.stringify(line) + "\n");
    const logsDir = path2.join(logDir, "logs");
    fs2.mkdirSync(logsDir, { recursive: true });
    const platformLog = path2.join(logsDir, `${event.platform}.log`);
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
    fs2.appendFileSync(platformLog, JSON.stringify(dataLine) + "\n");
  } catch {
  }
}

// src/core/config.ts
var fs3 = __toESM(require("node:fs"), 1);
var os3 = __toESM(require("node:os"), 1);
var path3 = __toESM(require("node:path"), 1);
function loadConfig(configDir = path3.join(os3.homedir(), ".alexandria"), env = process.env) {
  let fileConfig = {};
  try {
    const raw = fs3.readFileSync(path3.join(configDir, "config.json"), "utf8");
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
function formatHookOutput(platform, hookEventName, contextText) {
  switch (platform) {
    case "hermes":
      return { context: contextText };
    case "antigravity":
      if (hookEventName === "UserPromptSubmit") {
        return { injectSteps: [{ ephemeralMessage: contextText }] };
      }
      return {};
    default:
      return { systemMessage: contextText };
  }
}
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
async function runStdioHook(translate, stdout = "{}", io = defaultIO, options) {
  try {
    const raw = JSON.parse(await io.readStdin());
    const event = await translate(raw);
    event.project_name = resolveProjectName(event.session_id, event.project_name);
    await sendEvent(event, loadConfig());
    if ((event.hook_event_name === "UserPromptSubmit" || event.hook_event_name === "PostToolUse") && options?.contextStore) {
      const contextText = await options.contextStore.refresh(
        loadConfig().url,
        loadConfig().apiKey,
        event.session_id,
        [event.project_name],
        event.platform
      );
      if (contextText) {
        io.writeStdout(JSON.stringify(
          formatHookOutput(event.platform, event.hook_event_name, contextText)
        ));
        io.exit(0);
        return;
      }
    }
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
async function translatePreToolUse(raw) {
  const payload = raw;
  return {
    ...commonMapped(payload),
    platform: "antigravity",
    hook_event_name: "PreToolUse",
    event_data: buildEventData({
      tool_name: payload.toolCall?.name ?? null,
      tool_input: payload.toolCall?.args ?? null,
      tool_response: null
    })
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
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}
async function handlePre() {
  const raw = JSON.parse(await readStdin());
  const event = await translatePreToolUse(raw);
  const config = loadConfig();
  const mcpUrl = `${config.url}/api/mcp`;
  const mcpPayload = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "context_inject",
      arguments: {
        projects: [event.project_name],
        platform: event.platform
      }
    },
    id: 1
  };
  let additionalContext = "";
  try {
    const resp = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcpPayload),
      signal: AbortSignal.timeout(3e3)
    });
    const data = await resp.json();
    if (data?.result?.content?.[0]?.text) {
      additionalContext = data.result.content[0].text;
    }
  } catch {
  }
  const output = {};
  if (additionalContext) {
    output.decision = "allow";
    output.reason = additionalContext;
  } else {
    output.decision = "allow";
  }
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}
var mode = process.argv[2];
var contextStore = new ContextStore();
switch (mode) {
  case "pre":
    handlePre();
    break;
  case "post":
    runStdioHook(translatePostToolUse, "{}", void 0, { contextStore });
    break;
  case "preinvocation":
    runStdioHook(translatePreInvocation, "{}", void 0, { contextStore });
    break;
  case "stop":
    runStdioHook(translateStop, '{"decision":""}', void 0, { contextStore });
    break;
}
