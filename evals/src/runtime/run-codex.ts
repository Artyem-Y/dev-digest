import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCodexEvents } from "./codex-events.js";
import type { Result, RunOptions } from "./run-claude.js";

/** Content evaluation in a disposable directory. Project instructions are not loaded. */
export async function runCodex(prompt: string, opts: RunOptions = {}): Promise<Result> {
  const dir = await mkdtemp(join(tmpdir(), "devdigest-codex-eval-"));
  const start = Date.now();
  try {
    const args = ["exec", "--json", "--ephemeral", "--ignore-user-config", "--skip-git-repo-check", "--sandbox", "read-only", "-C", dir];
    if (opts.model) args.push("--model", opts.model);
    args.push("-");
    const task = [opts.systemPrompt, "Answer directly without using tools.", prompt].filter(Boolean).join("\n\n");
    return await new Promise<Result>((resolve) => {
      const child = spawn(process.env.CODEX_BIN || "codex", args, { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let timeout = false;
      const timer = setTimeout(() => { timeout = true; child.kill("SIGTERM"); }, 120_000);
      child.stdout.setEncoding("utf8").on("data", (data: string) => { stdout += data; });
      child.stderr.setEncoding("utf8").on("data", (data: string) => { stderr += data; });
      child.on("error", (error) => { stderr += error.message; });
      child.on("close", (code) => {
        clearTimeout(timer);
        const result = parseCodexEvents(stdout, timeout ? null : code);
        result.metrics.durationMs = Date.now() - start;
        if (result.toolsUsed.length) {
          result.isError = true;
          result.text = "Codex used tools during a content-only evaluation";
        }
        if (result.isError && !result.text) result.text = timeout ? "Codex session timed out" : stderr.slice(0, 2000) || "Codex session did not complete";
        resolve(result);
      });
      child.stdin.on("error", () => {});
      child.stdin.end(task);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
