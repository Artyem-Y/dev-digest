import { describe, expect, it } from "vitest";
import { parseCodexEvents } from "./codex-events.js";

describe("Codex JSONL results", () => {
  it("accepts a completed turn with a final agent message", () => {
    const jsonl = [
      { type: "thread.started", thread_id: "t" },
      { type: "item.completed", item: { type: "agent_message", text: "done" } },
      { type: "turn.completed", usage: { input_tokens: 4, output_tokens: 2 } },
    ].map((event) => JSON.stringify(event)).join("\n");
    expect(parseCodexEvents(jsonl, 0)).toMatchObject({ text: "done", isError: false, metrics: { inputTokens: 4, outputTokens: 2 } });
  });

  it.each([
    ["", 0],
    ['{"type":"turn.failed"}', 0],
    ['{"type":"turn.completed"}\nnot-json', 0],
    ['{"type":"turn.completed"}', 1],
  ])("rejects incomplete, invalid or failed executions", (jsonl, code) => {
    expect(parseCodexEvents(jsonl, code).isError).toBe(true);
  });
});
