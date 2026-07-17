// test/core/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadConfig } from "../../src/core/config.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alexandria-config-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("reads url and apiKey from config.json", () => {
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({ url: "https://alexandria.example.com", apiKey: "file-key" })
    );

    const config = loadConfig(tmpDir, {});

    expect(config).toEqual({ url: "https://alexandria.example.com", apiKey: "file-key" });
  });

  it("lets ALEXANDRIA_URL override the file's url", () => {
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({ url: "https://from-file.example.com" })
    );

    const config = loadConfig(tmpDir, { ALEXANDRIA_URL: "https://from-env.example.com" });

    expect(config.url).toBe("https://from-env.example.com");
  });

  it("lets ALEXANDRIA_API_KEY override the file's apiKey", () => {
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({ url: "https://alexandria.example.com", apiKey: "file-key" })
    );

    const config = loadConfig(tmpDir, { ALEXANDRIA_API_KEY: "env-key" });

    expect(config.apiKey).toBe("env-key");
  });

  it("returns an empty url and no apiKey when no config file exists and no env vars are set", () => {
    const config = loadConfig(tmpDir, {});

    expect(config).toEqual({ url: "" });
  });

  it("treats a malformed config file as empty rather than throwing", () => {
    fs.writeFileSync(path.join(tmpDir, "config.json"), "{ not valid json");

    const config = loadConfig(tmpDir, {});

    expect(config).toEqual({ url: "" });
  });
});
