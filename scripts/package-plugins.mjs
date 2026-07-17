import { build } from "esbuild";
import { mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const platforms = [
  { name: "claude-code", manifestDir: ".claude-plugin" },
  { name: "codex", manifestDir: ".codex-plugin" },
  { name: "hermes", manifestDir: null, shebang: true },
];

for (const platform of platforms) {
  const srcDir = join(repoRoot, "src/adapters", platform.name);
  const pluginDir = join(repoRoot, "plugins", platform.name);
  const outfile = join(pluginDir, "dist/cli.cjs");

  await build({
    entryPoints: [join(srcDir, "cli.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "info",
    banner: platform.shebang ? { js: "#!/usr/bin/env node" } : undefined,
  });

  if (platform.shebang) {
    chmodSync(outfile, 0o755);
  }

  if (platform.manifestDir) {
    mkdirSync(join(pluginDir, platform.manifestDir), { recursive: true });
    copyFileSync(
      join(srcDir, "manifest/plugin.json"),
      join(pluginDir, platform.manifestDir, "plugin.json")
    );

    mkdirSync(join(pluginDir, "hooks"), { recursive: true });
    copyFileSync(
      join(srcDir, "manifest/hooks/hooks.json"),
      join(pluginDir, "hooks/hooks.json")
    );
  }

  console.log(`Packaged ${platform.name} -> plugins/${platform.name}`);
}
