// src/adapters/hermes/mcp.ts
import { runMcpRelay } from "../../core/mcp-relay.js";
import { loadConfig } from "../../core/config.js";
runMcpRelay(loadConfig());
