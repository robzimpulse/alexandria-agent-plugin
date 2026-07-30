// test/core/mcp-relay.test.ts
import { EventEmitter } from "node:events";
import { describe, it, expect, vi } from "vitest";
import { processJsonRpcMessage, runMcpRelay } from "../../src/core/mcp-relay.js";

describe("processJsonRpcMessage", () => {
  const serverUrl = "https://alexandria.example.com/api/mcp";

  it("returns protocolVersion + capabilities on initialize", async () => {
    const request = {
      jsonrpc: "2.0" as const,
      method: "initialize",
      id: 1,
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: {} },
    };
    const response = await processJsonRpcMessage(request, serverUrl, undefined, { current: null });
    const parsed = JSON.parse(response!);
    expect(parsed.id).toBe(1);
    expect(parsed.result.protocolVersion).toBe("2025-03-26");
    expect(parsed.result.capabilities).toEqual({ tools: {} });
  });

  it("returns null for notifications/initialized", async () => {
    const response = await processJsonRpcMessage(
      { jsonrpc: "2.0" as const, method: "notifications/initialized" },
      serverUrl, undefined, { current: null },
    );
    expect(response).toBeNull();
  });

  it("returns empty tools list when server fetch fails", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Net err"));
    const response = await processJsonRpcMessage(
      { jsonrpc: "2.0" as const, method: "tools/list", id: 2 },
      serverUrl, undefined, { current: null }, mockFetch,
    );
    const parsed = JSON.parse(response!);
    expect(parsed.result).toEqual({ tools: [] });
  });

  it("returns cached tools/list on second call without hitting server", async () => {
    const cache = { current: { tools: [{ name: "search" }] } };
    const mockFetch = vi.fn(() => { throw new Error("unexpected"); });
    const response = await processJsonRpcMessage(
      { jsonrpc: "2.0" as const, method: "tools/list", id: 3 },
      serverUrl, undefined, cache, mockFetch,
    );
    const parsed = JSON.parse(response!);
    expect(parsed.result).toEqual({ tools: [{ name: "search" }] });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns error for unknown method", async () => {
    const response = await processJsonRpcMessage(
      { jsonrpc: "2.0" as const, method: "bogus", id: 4 },
      serverUrl, undefined, { current: null },
    );
    const parsed = JSON.parse(response!);
    expect(parsed.error.code).toBe(-32601);
    expect(parsed.error.message).toContain("bogus");
  });
});

describe("processJsonRpcMessage — server forwarding", () => {
  it("forwards tools/call with auth and returns result", async () => {
    const serverResp = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "result" }] } };
    const mockFetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(serverResp) });
    const request = { jsonrpc: "2.0" as const, method: "tools/call", id: 5, params: { name: "search", arguments: { q: "test" } } };

    const response = await processJsonRpcMessage(request, "url", "test-key", { current: null }, mockFetch as any);
    const parsed = JSON.parse(response!);
    expect(parsed.result.content[0].text).toBe("result");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body).method).toBe("tools/call");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("caches tools/list after first server fetch", async () => {
    const serverResp = { jsonrpc: "2.0", id: 1, result: { tools: [{ name: "search" }] } };
    const mockFetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(serverResp) });
    const cache = { current: null };

    const r1 = await processJsonRpcMessage({ jsonrpc: "2.0" as const, method: "tools/list", id: 6 }, "url", undefined, cache, mockFetch as any);
    expect(JSON.parse(r1!).result.tools[0].name).toBe("search");

    const mockFail = vi.fn(() => { throw new Error("should not call"); });
    const r2 = await processJsonRpcMessage({ jsonrpc: "2.0" as const, method: "tools/list", id: 7 }, "url", undefined, cache, mockFail as any);
    expect(JSON.parse(r2!).result.tools[0].name).toBe("search");
  });
});

describe("runMcpRelay", () => {
  it("responds to a Content-Length framed initialize request", async () => {
    const stdin = new EventEmitter() as NodeJS.ReadStream;
    (stdin as any).setEncoding = vi.fn();
    const stdout = new EventEmitter() as NodeJS.WriteStream;
    const written: string[] = [];
    stdout.write = vi.fn((chunk: string) => { written.push(chunk); return true; }) as any;

    runMcpRelay({ url: "https://example.com" }, { stdin, stdout });

    const request = JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      id: 42,
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: {} },
    });
    const frame = `Content-Length: ${Buffer.byteLength(request, "utf8")}\r\n\r\n${request}`;
    stdin.emit("data", frame);

    // flush pending microtasks (writeFrame is called via .then)
    await vi.waitFor(() => {
      expect(written.length).toBeGreaterThanOrEqual(1);
    });

    const headerMatch = written[0].match(/Content-Length: (\d+)\r\n\r\n/);
    expect(headerMatch).toBeTruthy();
    const headerSize = headerMatch![0].length;
    const body = written[0].slice(headerSize, headerSize + parseInt(headerMatch![1], 10));
    const parsed = JSON.parse(body);
    expect(parsed.id).toBe(42);
    expect(parsed.result.protocolVersion).toBe("2025-03-26");
  });
});
