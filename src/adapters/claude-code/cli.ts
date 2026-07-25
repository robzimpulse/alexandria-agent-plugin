import { ContextStore } from "../../core/context-store.js";
import { runStdioHook } from "../../core/runner.js";
import { translate } from "./translate.js";

const contextStore = new ContextStore();
runStdioHook(translate, "{}", undefined, { contextStore });
