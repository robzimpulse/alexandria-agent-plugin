import { sendEvent } from "../../core/client.js";
import { loadConfig } from "../../core/config.js";
import { createHandlers } from "./translate.js";

type PluginInput = {
  project: { id: string };
  directory: string;
  worktree: string;
};

export const AlexandriaCapture = async (ctx: PluginInput) => {
  const cwd = ctx.worktree || ctx.directory;
  const config = loadConfig();
  const handlers = createHandlers(
    (event) => sendEvent(event, config),
    cwd,
  );

  return {
    "event": async (input: { event: { type: string } & Record<string, any> }) => {
      const e = input.event;
      switch (e.type) {
        case "session.created":
          await handlers["session.created"](e as any);
          break;
        case "message.updated":
          await handlers["message.updated"](e as any);
          break;
        case "session.idle":
          await handlers["session.idle"](e as any);
          break;
        case "session.deleted":
          await handlers["session.deleted"](e as any);
          break;
      }
    },
    "tool.execute.after": async (input: any, output: any) => {
      await handlers["tool.execute.after"](input, output);
    },
  };
};
