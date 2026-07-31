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

// src/core/mcp-relay.ts
var fs = __toESM(require("node:fs"), 1);
var os = __toESM(require("node:os"), 1);
var path = __toESM(require("node:path"), 1);
var RELAY_VERSION = "0.2.1";
var LOG_FILE = path.join(os.homedir(), ".alexandria", "plugin.log");
function logError(msg, err) {
  try {
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        component: "mcp-relay",
        message: msg,
        error: err instanceof Error ? err.message : String(err)
      }) + "\n"
    );
  } catch {
  }
}
var PROTOCOL_VERSION = "2025-03-26";
var CACHE_TTL = 6e4;
function isToolsCacheStale(cacheRef) {
  if (!cacheRef.current) return true;
  const cached = cacheRef.current;
  if (cached && Array.isArray(cached.tools) && cached.tools.length === 0) return true;
  if (cacheRef.cachedAt && Date.now() - cacheRef.cachedAt > CACHE_TTL) return true;
  return false;
}
async function processJsonRpcMessage(request, serverUrl, apiKey, toolsCacheRef, fetchFn = globalThis.fetch) {
  const req = request;
  if (req.method === "initialize") {
    return JSON.stringify({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "alexandria-mcp-relay", version: RELAY_VERSION }
      }
    });
  }
  if (req.method === "notifications/initialized") return null;
  if (req.method === "ping") return JSON.stringify({ jsonrpc: "2.0", id: req.id, result: {} });
  if (req.method === "tools/list") {
    if (toolsCacheRef.current && !isToolsCacheStale(toolsCacheRef)) {
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, result: toolsCacheRef.current });
    }
    try {
      const resp = await fetchFn(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKey ? { Authorization: `Bearer ${apiKey}` } : {} },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
        signal: AbortSignal.timeout(5e3)
      });
      const data = await resp.json();
      toolsCacheRef.current = data?.result ?? { tools: [] };
      toolsCacheRef.cachedAt = Date.now();
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, result: toolsCacheRef.current });
    } catch (err) {
      logError("tools/list failed", err);
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { tools: [] } });
    }
  }
  if (req.method === "tools/call") {
    try {
      const resp = await fetchFn(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKey ? { Authorization: `Bearer ${apiKey}` } : {} },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(3e4)
      });
      const data = await resp.json();
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, ...data });
    } catch (err) {
      logError("tools/call failed", err);
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: "Internal error" } });
    }
  }
  return JSON.stringify({
    jsonrpc: "2.0",
    id: req.id,
    error: { code: -32601, message: `Method not found: ${req.method}` }
  });
}
function runMcpRelay(config, deps) {
  const serverUrl = `${config.url}/api/mcp`;
  const toolsCacheRef = { current: null };
  const stdin = deps?.stdin ?? process.stdin;
  const stdout = deps?.stdout ?? process.stdout;
  const fetchFn = deps?.fetchFn ?? globalThis.fetch;
  let buffer = "";
  function writeFrame(text) {
    const bytes = Buffer.byteLength(text, "utf8");
    stdout.write(`Content-Length: ${bytes}\r
\r
${text}`);
  }
  function processBuffer() {
    while (buffer.length > 0) {
      const headerMatch = buffer.match(/^Content-Length: (\d+)\r\n\r\n/);
      if (headerMatch) {
        const len = parseInt(headerMatch[1], 10);
        const headerSize = headerMatch[0].length;
        if (buffer.length < headerSize + len) break;
        const body = buffer.slice(headerSize, headerSize + len);
        buffer = buffer.slice(headerSize + len);
        processJsonRpcMessage(safeParse(body), serverUrl, config.apiKey, toolsCacheRef, fetchFn).then((r) => {
          if (r) writeFrame(r);
        }).catch((e) => logError("processing", e));
        continue;
      }
      const nl = buffer.indexOf("\n");
      if (nl === -1) break;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.trim()) {
        const parsed = safeParse(line.trim());
        if (parsed) {
          processJsonRpcMessage(parsed, serverUrl, config.apiKey, toolsCacheRef, fetchFn).then((r) => {
            if (r) writeFrame(r);
          }).catch((e) => logError("processing", e));
        } else {
          logError("ignoring non-MCP data", line.trim());
        }
      }
    }
  }
  stdin.setEncoding("utf8");
  stdin.on("data", (chunk) => {
    buffer += chunk;
    processBuffer();
  });
  stdin.on("error", (e) => logError("stdin", e));
  stdin.on("end", () => processBuffer());
}
function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
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

// src/adapters/claude-code/mcp.ts
runMcpRelay(loadConfig());
