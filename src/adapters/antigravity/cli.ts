import { runStdioHook } from "../../core/runner.js";
import {
  translatePostToolUse,
  translatePreInvocation,
  translateStop,
} from "./translate.js";

const mode = process.argv[2];

switch (mode) {
  case "pre":
    // PreToolUse removed from canonical event set — this case is no longer dispatched.
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
