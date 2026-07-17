// src/core/runner.ts
import type { CanonicalHookEvent } from "./schema.js";
import { sendEvent } from "./client.js";
import { loadConfig } from "./config.js";

export type RunnerIO = {
  readStdin: () => Promise<string>;
  writeStdout: (text: string) => void;
  exit: (code: number) => void;
};

const defaultIO: RunnerIO = {
  readStdin: () =>
    new Promise((resolve) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data));
    }),
  writeStdout: (text) => {
    process.stdout.write(text);
  },
  exit: (code) => {
    process.exit(code);
  },
};

export async function runStdioHook(
  translate: (raw: unknown) => CanonicalHookEvent | Promise<CanonicalHookEvent>,
  stdout: string = "{}",
  io: RunnerIO = defaultIO
): Promise<void> {
  try {
    const raw = JSON.parse(await io.readStdin());
    const event = await translate(raw);
    await sendEvent(event, loadConfig());
  } catch {
    // Fail-silent: a bad/malformed translate() must never surface as a
    // nonzero exit, missing stdout, or stderr noise to the host platform.
  }
  io.writeStdout(stdout);
  io.exit(0);
}
