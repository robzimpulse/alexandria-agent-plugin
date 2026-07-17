import { runStdioHook } from "../../core/runner.js";
import {
  translatePreToolUse,
  translatePostToolUse,
  translatePreInvocation,
  translateStop,
} from "./translate.js";

const mode = process.argv[2];

switch (mode) {
  case "pre":
    await runStdioHook(translatePreToolUse, '{"decision":"allow"}');
    break;
  case "post":
    await runStdioHook(translatePostToolUse, "{}");
    break;
  case "preinvocation":
    await runStdioHook(translatePreInvocation, "{}");
    break;
  case "stop":
    await runStdioHook(translateStop, '{"decision":""}');
    break;
}
