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
async function runStdioHook(translate2, stdout = "{}", io = defaultIO, options) {
  try {
    const raw = JSON.parse(await io.readStdin());
    const event = await translate2(raw);
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
        io.writeStdout(JSON.stringify({
          hookSpecificOutput: { additionalContext: contextText }
        }));
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

// src/core/transcript-reader.ts
var fs5 = __toESM(require("node:fs"), 1);

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

// src/core/transcript-reader.ts
function detectPlatform(line) {
  try {
    const entry = JSON.parse(line);
    if (entry.source) return "antigravity";
    if (entry.type === "user" || entry.type === "assistant") return "claude-code";
    if (entry.role === "user" || entry.role === "assistant") return "codex";
    if (entry.payload?.role === "user" || entry.payload?.role === "assistant") return "codex";
    const codexLineTypes = ["response_item", "event_msg", "session_meta", "world_state", "turn_context"];
    if (codexLineTypes.includes(entry.type ?? "")) return "codex";
    return null;
  } catch {
    return null;
  }
}
function extractFromContentArray(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts = content.filter((c) => c.type === "input_text" || c.type === "text").map((c) => c.text).filter(Boolean);
    return texts.length > 0 ? texts.join("\n") : null;
  }
  return null;
}
function extractUserText(entry) {
  if (entry.type === "user" && entry.message && typeof entry.message.content === "string") {
    return entry.message.content;
  }
  if (entry.type === "event_msg" && entry.payload?.type === "user_message" && typeof entry.payload.message === "string") {
    return entry.payload.message;
  }
  if (entry.payload?.role === "user" && entry.payload?.content) {
    return extractFromContentArray(entry.payload.content);
  }
  if (entry.role === "user" && typeof entry.content === "string") {
    return entry.content;
  }
  if (entry.role === "user" && entry.message && typeof entry.message.content === "string") {
    return entry.message.content;
  }
  return null;
}
async function readLatestUserMessage(transcriptPath, platform) {
  try {
    const content = await fs5.promises.readFile(transcriptPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const resolvedPlatform = platform ?? detectPlatform(lines[0]);
    if (!resolvedPlatform) return null;
    if (resolvedPlatform === "antigravity") {
      return readLatestUserPrompt(transcriptPath);
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        const text = extractUserText(entry);
        if (text) return text;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// src/adapters/claude-code/translate.ts
async function translate(raw) {
  const payload = raw;
  const eventDataFields = {};
  if (payload.hook_event_name === "UserPromptSubmit") {
    if (payload.prompt !== void 0) {
      eventDataFields.prompt = payload.prompt;
    } else if (payload.transcript_path) {
      eventDataFields.prompt = await readLatestUserMessage(
        payload.transcript_path,
        "claude-code"
      );
    }
  }
  if (payload.hook_event_name === "PostToolUse") {
    eventDataFields.tool_name = payload.tool_name ?? null;
    eventDataFields.tool_input = payload.tool_input ?? null;
    eventDataFields.tool_response = payload.tool_response ?? null;
  }
  return {
    session_id: payload.session_id,
    project_name: payload.cwd,
    platform: "claude-code",
    hook_event_name: payload.hook_event_name,
    event_data: buildEventData(eventDataFields)
  };
}

// src/adapters/claude-code/cli.ts
var contextStore = new ContextStore();
runStdioHook(translate, "{}", void 0, { contextStore });
