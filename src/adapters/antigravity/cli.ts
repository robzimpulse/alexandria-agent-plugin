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
    runStdioHook(translatePreToolUse, '{"decision":"allow"}');
    break;
  case "post":
    runStdioHook(translatePostToolUse, "{}");
    break;
  case "preinvocation":
    runStdioHook(translatePreInvocation, "{}");
    break;
  case "stop":
    runStdioHook(translateStop, '{"decision":""}');
    break;
}
