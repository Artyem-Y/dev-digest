import type { Result } from "../runtime/run-claude.js";

export function assertSessionSucceeded(result: Pick<Result, "isError" | "text">): void {
  if (result.isError) throw new Error(`Eval session failed: ${result.text || "no error details"}`);
}
