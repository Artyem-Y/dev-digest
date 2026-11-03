import type { Result } from "./run-claude.js";

/** Parse only evidence actually emitted by the CLI; do not infer file reads or skill activation. */
export function parseCodexEvents(jsonl: string, exitCode: number | null): Result {
  let text = "";
  let completed = false;
  let failed = exitCode !== 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const tools: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.failed" || event.type === "error") failed = true;
      if (event.type === "turn.completed") {
        completed = true;
        inputTokens = event.usage?.input_tokens ?? 0;
        outputTokens = event.usage?.output_tokens ?? 0;
      }
      if (event.type === "item.completed" && event.item?.type === "agent_message") text = event.item.text ?? "";
      if (event.type === "item.completed" && ["command_execution", "file_change", "mcp_tool_call", "web_search", "collab_tool_call"].includes(event.item?.type)) tools.push(event.item.type);
    } catch { failed = true; }
  }
  return { text, isError: failed || !completed || !text, toolsUsed: tools, subagents: [], skillsInvoked: [], filesRead: [], numTurns: completed ? 1 : 0,
    metrics: { durationMs: 0, inputTokens, outputTokens, toolCallCount: tools.length } };
}
