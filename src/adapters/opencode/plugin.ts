import { sendEvent } from "../../core/client.js";
import { loadConfig } from "../../core/config.js";
import { createHandlers } from "./translate.js";

type PluginInput = {
  project: { id: string };
  directory: string;
  worktree: string;
};

// --- Schema conversion ---

export type ConvertedSchema = {
  __type: string;
  __properties?: Record<string, ConvertedSchema>;
  __items?: ConvertedSchema;
};

export function convertJsonSchema(schema: any): ConvertedSchema {
  if (!schema || !schema.type) return { __type: "string" };
  switch (schema.type) {
    case "string": return { __type: "string" };
    case "number":
    case "integer": return { __type: "number" };
    case "boolean": return { __type: "boolean" };
    case "object": {
      const r: ConvertedSchema = { __type: "object" };
      if (schema.properties) {
        r.__properties = {};
        for (const [k, v] of Object.entries(schema.properties)) {
          r.__properties[k] = convertJsonSchema(v);
        }
      }
      return r;
    }
    case "array": return { __type: "array", __items: schema.items ? convertJsonSchema(schema.items) : { __type: "string" } };
    default: return { __type: "string" };
  }
}

export type DiscoveredTool = { name: string; description: string; inputSchema: any };

let toolsCache: DiscoveredTool[] | null = null;

export function clearToolsCache(): void { toolsCache = null; }

export async function discoverTools(
  url: string,
  apiKey: string | undefined,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<DiscoveredTool[]> {
  try {
    const resp = await fetchFn(`${url}/api/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await resp.json()) as any;
    return data?.result?.tools ?? [];
  } catch { return []; }
}

function jsonSchemaToArgs(schema: any): Record<string, any> {
  const conv = convertJsonSchema(schema ?? {});
  if (conv.__type !== "object" || !conv.__properties) return {};
  const args: Record<string, any> = {};
  for (const [key, val] of Object.entries(conv.__properties)) {
    switch (val.__type) {
      case "string": args[key] = { type: "string" }; break;
      case "number": args[key] = { type: "number" }; break;
      case "boolean": args[key] = { type: "boolean" }; break;
      case "array": args[key] = { type: "array", items: { type: "string" } }; break;
      default: args[key] = { type: "string" }; break;
    }
  }
  return args;
}

// --- Main plugin factory ---

export const AlexandriaCapture = async (ctx: PluginInput) => {
  const cwd = ctx.worktree || ctx.directory;
  const config = loadConfig();
  const handlers = createHandlers((event) => sendEvent(event, config), cwd);

  if (!toolsCache) {
    toolsCache = await discoverTools(config.url, config.apiKey);
  }

  const toolRegistrations: Record<string, any> = {};
  for (const t of toolsCache) {
    toolRegistrations[t.name] = {
      description: t.description ?? "",
      args: jsonSchemaToArgs(t.inputSchema),
      async execute(args: any) {
        try {
          const resp = await fetch(`${config.url}/api/mcp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
            },
            body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name: t.name, arguments: args }, id: 1 }),
            signal: AbortSignal.timeout(30000),
          });
          const data = (await resp.json()) as any;
          return data?.result?.content?.[0]?.text ?? JSON.stringify(data?.result ?? {});
        } catch { return "Error: failed to call Alexandria server tool"; }
      },
    };
  }

  return {
    "event": async (input: { event: { type: string } & Record<string, any> }) => {
      const e = input.event;
      switch (e.type) {
        case "session.created": await handlers["session.created"](e as any); break;
        case "message.updated": await handlers["message.updated"](e as any); break;
        case "session.idle": await handlers["session.idle"](e as any); break;
        case "session.deleted": await handlers["session.deleted"](e as any); break;
      }
    },
    "tool.execute.after": async (input: any, output: any) => {
      await handlers["tool.execute.after"](input, output);
    },
    tool: toolRegistrations,
  };
};
