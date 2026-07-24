import { describe, it, expect } from "vitest";
import * as path from "node:path";
import {
  detectPlatform,
  readLatestUserMessage,
  readToolCallByIndex,
} from "../../src/core/transcript-reader.js";

const fixturesDir = path.join(process.cwd(), "test/fixtures");

describe("detectPlatform", () => {
  it("detects claude-code from type field", () => {
    expect(detectPlatform('{"type":"user","message":{}}')).toBe("claude-code");
  });

  it("detects codex/cursor from role field", () => {
    expect(detectPlatform('{"role":"user","content":"hi"}')).toBe("codex");
  });

  it("detects codex from payload.role field", () => {
    expect(detectPlatform('{"type":"response_item","payload":{"role":"user"}}')).toBe("codex");
  });

  it("detects codex from codex-specific types", () => {
    expect(detectPlatform('{"type":"event_msg","payload":{}}')).toBe("codex");
  });

  it("detects antigravity from source field", () => {
    expect(detectPlatform('{"source":"USER_EXPLICIT","type":"USER_INPUT"}')).toBe("antigravity");
  });

  it("returns null for unparseable line", () => {
    expect(detectPlatform("not json")).toBeNull();
  });
});

describe("readLatestUserMessage", () => {
  it("reads last user message from claude-code transcript", async () => {
    const result = await readLatestUserMessage(
      path.join(fixturesDir, "claude-code/transcript.jsonl"),
      "claude-code"
    );
    expect(result).toBe("can you add error handling?");
  });

  it("reads last user message from codex transcript", async () => {
    const result = await readLatestUserMessage(
      path.join(fixturesDir, "codex/transcript.jsonl"),
      "codex"
    );
    expect(result).toBe("add tests for the new endpoint");
  });

  it("reads last user message from cursor transcript", async () => {
    const result = await readLatestUserMessage(
      path.join(fixturesDir, "cursor/transcript.jsonl"),
      "cursor"
    );
    expect(result).toBe("add rate limiting");
  });

  it("delegates to antigravity reader for antigravity platform", async () => {
    const result = await readLatestUserMessage(
      path.join(fixturesDir, "antigravity/transcript.jsonl"),
      "antigravity"
    );
    expect(result).toBe("fetch the data again");
  });

  it("returns null when platform detection fails (no platform hint, and can't detect)", async () => {
    const result = await readLatestUserMessage(
      path.join(fixturesDir, "claude-code/transcript.jsonl"),
      undefined
    );
    // Should auto-detect from first line
    expect(result).toBe("can you add error handling?");
  });

  it("returns null for nonexistent file", async () => {
    const result = await readLatestUserMessage("/nonexistent.jsonl", "claude-code");
    expect(result).toBeNull();
  });
});

describe("readToolCallByIndex", () => {
  it("delegates to antigravity reader for antigravity platform", async () => {
    const result = await readToolCallByIndex(
      path.join(fixturesDir, "antigravity/transcript.jsonl"),
      "antigravity",
      2
    );
    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("run_command");
  });

  it("returns null for non-antigravity platforms", async () => {
    const result = await readToolCallByIndex("/any.jsonl", "claude-code", 0);
    expect(result).toBeNull();
  });
});