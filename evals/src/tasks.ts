/**
 * The three ways to run a case. Each composes runtime + artifacts; nothing here talks to the
 * SDK directly.
 *
 *   skillTask / agentTask — inject the artifact's content as system prompt, load NO on-disk
 *     config → measures the artifact's CONTENT in isolation.
 *   workflowTask — load the real on-disk harness (settingSources:["project"]) → measures the
 *     SYSTEMIC effect: does a skill activate, does a subagent dispatch, does CLAUDE.md matter.
 */

import { IS_BASELINE, WORKFLOW_ALLOWED_TOOLS } from "./config.js";
import { resolve } from "node:path";
import { runClaude, type RunOptions } from "./runtime/run-claude.js";
import { runContent } from "./runtime/dispatch.js";
import { skillContent, skillContentFromDir, agentContent, agentTools } from "./artifacts/load.js";
import { REPO_ROOT } from "./artifacts/paths.js";

/**
 * Run a prompt with a skill's content injected (the 'candidate' condition). In the benchmark's
 * baseline condition, EVAL_BASELINE_SKILL_DIR optionally injects a versioned skill snapshot;
 * when unset, baseline is the raw model without a skill.
 */
export function skillTask(prompt: string, skillName: string, opts: RunOptions = {}) {
  const baselineSkillDir = process.env.EVAL_BASELINE_SKILL_DIR;
  const systemPrompt = IS_BASELINE
    ? baselineSkillDir
      ? skillContentFromDir(resolve(REPO_ROOT, baselineSkillDir))
      : undefined
    : skillContent(skillName);
  return runContent(prompt, { ...opts, systemPrompt });
}

/**
 * Run a prompt with a subagent's definition injected as the system prompt (baseline: none).
 *
 * A subagent is a TOOL-USING artifact — its whole method is "read the docs, grep the imports".
 * Running it content-only (no tools) both contradicts its own body ("you have Read/Glob/Grep")
 * and trips runClaude's "you have NO tools" directive, which makes a doc-grounded reviewer refuse
 * or downgrade every finding to `cannot-verify`. So we hand it exactly the tools it declares in
 * frontmatter and let it run from REPO_ROOT (runClaude's default cwd), the way production does.
 * Both conditions (candidate + baseline) get the same tools so the measured lift stays fair.
 */
export function agentTask(prompt: string, agentName: string, opts: RunOptions = {}) {
  if (process.env.EVAL_BACKEND === "codex") throw new Error("Codex agent trajectory evals are not implemented; use the existing Codex-specific eval runners.");
  const systemPrompt = IS_BASELINE ? undefined : agentContent(agentName);
  const allowedTools = agentTools(agentName);
  return runClaude(prompt, { allowedTools, ...opts, systemPrompt });
}

/**
 * Run a prompt against the REAL on-disk harness (CLAUDE.md + project skills/agents loaded).
 * Use for workflow-level evals: skill activation, subagent dispatch, CLAUDE.md effect.
 * Ignores EVAL_CONFIG — the workflow tier has its own control-vs-treatment design.
 *
 * Safety: keep allowedTools a read-only allow-list (no Bash/Write/Edit) — a fresh session
 * with bypassPermissions could otherwise take real actions in the repo.
 */
export function workflowTask(prompt: string, opts: RunOptions = {}) {
  if (process.env.EVAL_BACKEND === "codex") throw new Error("Codex workflow trajectory evals are not implemented; use the existing Codex-specific eval runners.");
  return runClaude(prompt, {
    allowedTools: WORKFLOW_ALLOWED_TOOLS,
    ...opts,
    settingSources: ["project"],
  });
}
