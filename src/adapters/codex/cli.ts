//
// Install note: Codex requires an explicit one-time trust step before this
// hook will actually fire. After installing this plugin, run `/hooks` in
// the Codex CLI and trust its hook definitions — Codex hashes the hook
// definition, so any future edit to it re-triggers review. For scripted or
// automated installs where an interactive `/hooks` session isn't available,
// pass `--dangerously-bypass-hook-trust` instead of expecting the prompt.
import { ContextStore } from "../../core/context-store.js";
import { runStdioHook } from "../../core/runner.js";
import { translate } from "./translate.js";

const contextStore = new ContextStore();
runStdioHook(translate, "{}", undefined, { contextStore });
