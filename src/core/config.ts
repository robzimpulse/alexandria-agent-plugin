import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type Config = {
  url: string;
  apiKey?: string;
};

export function loadConfig(
  configDir: string = path.join(os.homedir(), ".alexandria"),
  env: NodeJS.ProcessEnv = process.env
): Config {
  let fileConfig: { url?: string; apiKey?: string } = {};

  try {
    const raw = fs.readFileSync(path.join(configDir, "config.json"), "utf8");
    fileConfig = JSON.parse(raw);
  } catch {
    fileConfig = {};
  }

  const url = env.ALEXANDRIA_URL ?? fileConfig.url ?? "";
  const apiKey = env.ALEXANDRIA_API_KEY ?? fileConfig.apiKey;

  return apiKey ? { url, apiKey } : { url };
}
