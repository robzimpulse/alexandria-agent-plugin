import { ContextStore } from "../../core/context-store.js";
import { runStdioHook } from "../../core/runner.js";
import { loadConfig } from "../../core/config.js";
import {
  translatePostToolUse,
  translatePreInvocation,
  translatePreToolUse,
  translateStop,
} from "./translate.js";

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}

async function handlePre(): Promise<void> {
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
        platform: event.platform,
      },
    },
    id: 1,
  };

  let additionalContext = "";
  try {
    const resp = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcpPayload),
      signal: AbortSignal.timeout(3000),
    });
    const data = (await resp.json()) as any;
    if (data?.result?.content?.[0]?.text) {
      additionalContext = data.result.content[0].text;
    }
  } catch {
    // Server unreachable — return no context
  }

  const output: Record<string, unknown> = {};
  if (additionalContext) {
    output.hookSpecificOutput = { hookEventName: "PreToolUse" };
    output.systemMessage = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

const mode = process.argv[2];

const contextStore = new ContextStore();

switch (mode) {
  case "pre":
    handlePre();
    break;
  case "post":
    runStdioHook(translatePostToolUse, "{}", undefined, { contextStore });
    break;
  case "preinvocation":
    runStdioHook(translatePreInvocation, "{}", undefined, { contextStore });
    break;
  case "stop":
    runStdioHook(translateStop, '{"decision":""}', undefined, { contextStore });
    break;
}
