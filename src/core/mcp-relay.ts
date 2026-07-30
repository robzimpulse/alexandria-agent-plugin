// src/core/mcp-relay.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Config } from "./config.js";

const LOG_FILE = path.join(os.homedir(), ".alexandria", "plugin.log");

function logError(msg: string, err?: unknown): void {
  try {
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        component: "mcp-relay",
        message: msg,
        error: err instanceof Error ? err.message : String(err),
      }) + "\n",
    );
  } catch { /* silent */ }
}

const PROTOCOL_VERSION = "2025-03-26";

export async function processJsonRpcMessage(
  request: unknown,
  serverUrl: string,
  apiKey: string | undefined,
  toolsCacheRef: { current: unknown },
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  const req = request as { jsonrpc: string; method: string; id?: number | string; params?: unknown };

  if (req.method === "initialize") {
    return JSON.stringify({
      jsonrpc: "2.0", id: req.id,
      result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} } },
    });
  }

  if (req.method === "notifications/initialized") return null;

  if (req.method === "tools/list") {
    if (toolsCacheRef.current) {
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, result: toolsCacheRef.current });
    }
    try {
      const resp = await fetchFn(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
        signal: AbortSignal.timeout(5000),
      });
      const data = (await resp.json()) as any;
      toolsCacheRef.current = data?.result ?? { tools: [] };
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
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, ...data });
    } catch (err) {
      logError("tools/call failed", err);
      return JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: "Internal error" } });
    }
  }

  return JSON.stringify({
    jsonrpc: "2.0", id: req.id,
    error: { code: -32601, message: `Method not found: ${req.method}` },
  });
}

export function runMcpRelay(
  config: Config,
  deps?: { stdin?: NodeJS.ReadStream; stdout?: NodeJS.WriteStream; fetchFn?: typeof fetch },
): void {
  const serverUrl = `${config.url}/api/mcp`;
  const toolsCacheRef: { current: unknown } = { current: null };
  const stdin = deps?.stdin ?? process.stdin;
  const stdout = deps?.stdout ?? process.stdout;
  const fetchFn = deps?.fetchFn ?? globalThis.fetch;
  let buffer = "";

  function writeFrame(text: string): void {
    const bytes = Buffer.byteLength(text, "utf8");
    stdout.write(`Content-Length: ${bytes}\r\n\r\n${text}`);
  }

  function processBuffer(): void {
    while (buffer.length > 0) {
      const headerMatch = buffer.match(/^Content-Length: (\d+)\r\n\r\n/);
      if (headerMatch) {
        const len = parseInt(headerMatch[1], 10);
        const headerSize = headerMatch[0].length;
        if (buffer.length < headerSize + len) break;
        const body = buffer.slice(headerSize, headerSize + len);
        buffer = buffer.slice(headerSize + len);
        processJsonRpcMessage(safeParse(body), serverUrl, config.apiKey, toolsCacheRef, fetchFn)
          .then((r) => { if (r) writeFrame(r); })
          .catch((e) => logError("processing", e));
        continue;
      }
      const nl = buffer.indexOf("\n");
      if (nl === -1) break;
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      processJsonRpcMessage(safeParse(line), serverUrl, config.apiKey, toolsCacheRef, fetchFn)
        .then((r) => { if (r) writeFrame(r); })
        .catch((e) => logError("processing", e));
    }
  }

  stdin.setEncoding("utf8");
  stdin.on("data", (chunk: string) => { buffer += chunk; processBuffer(); });
  stdin.on("error", (e) => logError("stdin", e));
  stdin.on("end", () => processBuffer());
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}
