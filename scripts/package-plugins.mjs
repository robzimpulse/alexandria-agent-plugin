import { build } from "esbuild";
import { mkdirSync, copyFileSync, chmodSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgVersion = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8")).version;

// MCP config JSON per platform (written directly, no template files)
const MCP_CONFIGS = {
  "claude-code": {
    alexandria: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/dist/mcp.cjs"] },
  },
  "codex": {
    alexandria: { command: "node", args: ["${PLUGIN_ROOT}/dist/mcp.cjs"] },
  },
  "cursor": {
    alexandria: { command: "node", args: ["${CURSOR_PLUGIN_ROOT}/dist/mcp.cjs"] },
  },
  "antigravity": {
    alexandria: { command: "node", args: ["/ABSOLUTE/PATH/dist/mcp.cjs"] },
  },
};

const platforms = [
  {
    name: "claude-code",
    pluginJsonDest: ".claude-plugin/plugin.json",
    hooksJsonSrc: "manifest/hooks/hooks.json",
    hooksJsonDest: "hooks/hooks.json",
    mcp: true,
    mcpConfigDest: ".mcp.json",
  },
  {
    name: "codex",
    pluginJsonDest: ".codex-plugin/plugin.json",
    hooksJsonSrc: "manifest/hooks/hooks.json",
    hooksJsonDest: "hooks/hooks.json",
    mcp: true,
    mcpConfigDest: ".mcp.json",
  },
  { name: "hermes", shebang: true, mcp: true },
  {
    name: "antigravity",
    pluginJsonDest: "plugin.json",
    hooksJsonSrc: "manifest/hooks.json",
    hooksJsonDest: "hooks.json",
    mcp: true,
    mcpConfigDest: "mcp_config.json",
  },
  { name: "opencode", format: "esm", entryFile: "plugin.ts", outfileBasename: "plugin.js", shebang: false },
  {
    name: "cursor",
    pluginJsonDest: ".cursor-plugin/plugin.json",
    hooksJsonSrc: "manifest/hooks.json",
    hooksJsonDest: "hooks.json",
    mcp: true,
    mcpConfigDest: ".mcp.json",
  },
];

for (const platform of platforms) {
  const srcDir = join(repoRoot, "src/adapters", platform.name);
  const pluginDir = join(repoRoot, "plugins", platform.name);
  const entryFile = platform.entryFile || "cli.ts";
  const outfileBasename = platform.outfileBasename || "cli.cjs";
  const outfile = join(pluginDir, "dist", outfileBasename);

  await build({
    entryPoints: [join(srcDir, entryFile)],
    bundle: true,
    platform: "node",
    format: platform.format || "cjs",
    outfile,
    logLevel: "info",
    banner: platform.shebang ? { js: "#!/usr/bin/env node" } : undefined,
  });

  // Bundle MCP relay entrypoint
  if (platform.mcp) {
    const mcpOutfile = join(pluginDir, "dist", "mcp.cjs");
    await build({
      entryPoints: [join(srcDir, "mcp.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: mcpOutfile,
      logLevel: "info",
    });
    if (platform.shebang) chmodSync(mcpOutfile, 0o755);
  }

  // Write MCP config file
  if (platform.mcpConfigDest && MCP_CONFIGS[platform.name]) {
    const dest = join(pluginDir, platform.mcpConfigDest);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(MCP_CONFIGS[platform.name], null, 2) + "\n");
  }

  if (platform.shebang) chmodSync(outfile, 0o755);

  if (platform.pluginJsonDest) {
    const src = join(srcDir, "manifest/plugin.json");
    const dest = join(pluginDir, platform.pluginJsonDest);
    mkdirSync(dirname(dest), { recursive: true });
    const manifest = JSON.parse(readFileSync(src, "utf-8"));
    manifest.version = pkgVersion;
    writeFileSync(dest, JSON.stringify(manifest, null, 2) + "\n");
  }

  if (platform.hooksJsonDest) {
    const dest = join(pluginDir, platform.hooksJsonDest);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(srcDir, platform.hooksJsonSrc), dest);
  }

  console.log(`Packaged ${platform.name} -> plugins/${platform.name}`);
}
