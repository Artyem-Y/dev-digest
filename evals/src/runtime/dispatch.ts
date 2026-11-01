/**
 * Content-tier runner selection. Codex CLI, OpenRouter and Claude use separate runners.
 *
 * Tool-using tiers (agentTask, workflowTask) do NOT use this — they call runClaude directly,
 * because only the Agent SDK produces the subagent/skill/file-read trace they assert on.
 */

import { runClaude, type Result, type RunOptions } from "./run-claude.js";
import { runOpenRouter } from "./run-openrouter.js";
import { runCodex } from "./run-codex.js";

const BACKEND = process.env.EVAL_BACKEND ?? "subscription";

export function runContent(prompt: string, opts: RunOptions = {}): Promise<Result> {
  if (BACKEND === "codex") return runCodex(prompt, opts);
  return BACKEND === "openrouter" ? runOpenRouter(prompt, opts) : runClaude(prompt, opts);
}
