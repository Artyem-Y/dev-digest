import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "../artifacts/paths.js";
import { EVAL_MODEL, EVAL_JUDGE_MODEL } from "../config.js";

/** Conservatively hash harness, fixtures and graders, never the candidate artifact itself. */
export function evalIdentity(args: string[]): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ args, taskModel: EVAL_MODEL, judgeModel: EVAL_JUDGE_MODEL, backend: process.env.EVAL_BACKEND ?? "subscription", config: process.env.EVAL_CONFIG ?? "candidate", maxTurns: process.env.EVAL_MAX_TURNS ?? "8", sessionBudget: process.env.EVAL_SESSION_BUDGET_USD ?? null }));
  const visit = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) { hash.update(relative(REPO_ROOT, file)); hash.update(readFileSync(file)); }
    }
  };
  for (const dir of ["evals/src", "evals/skills", "evals/agents", "evals/workflow"]) visit(join(REPO_ROOT, dir));
  const skills = join(REPO_ROOT, ".claude/skills");
  if (existsSync(skills)) for (const entry of readdirSync(skills, { withFileTypes: true })) if (entry.isDirectory()) visit(join(skills, entry.name, "evals"));
  return hash.digest("hex");
}

export function assertComparable(a: { evalIdentity?: string }, b: { evalIdentity?: string }): void {
  if (!a.evalIdentity || a.evalIdentity !== b.evalIdentity) throw new Error("Cannot compare runs: evaluation identity is missing or differs (fixtures, grader, harness, model, or selection).");
}
