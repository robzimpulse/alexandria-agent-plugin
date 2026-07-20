import { build } from "esbuild";
import { mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const platforms = [
  {
    name: "claude-code",
    pluginJsonDest: ".claude-plugin/plugin.json",
    hooksJsonSrc: "manifest/hooks/hooks.json",
    hooksJsonDest: "hooks/hooks.json",
  },
  {
    name: "codex",
    pluginJsonDest: ".codex-plugin/plugin.json",
    hooksJsonSrc: "manifest/hooks/hooks.json",
    hooksJsonDest: "hooks/hooks.json",
  },
  { name: "hermes", shebang: true },
  {
    name: "antigravity",
    pluginJsonDest: "plugin.json",
    hooksJsonSrc: "manifest/hooks.json",
    hooksJsonDest: "hooks.json",
  },
  { name: "opencode", format: "esm", entryFile: "plugin.ts", outfileBasename: "plugin.js", shebang: false },
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

  if (platform.shebang) {
    chmodSync(outfile, 0o755);
  }

  if (platform.pluginJsonDest) {
    const dest = join(pluginDir, platform.pluginJsonDest);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(srcDir, "manifest/plugin.json"), dest);
  }

  if (platform.hooksJsonDest) {
    const dest = join(pluginDir, platform.hooksJsonDest);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(srcDir, platform.hooksJsonSrc), dest);
  }

  console.log(`Packaged ${platform.name} -> plugins/${platform.name}`);
}
