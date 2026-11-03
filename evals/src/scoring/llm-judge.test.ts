import { describe, expect, it, vi } from "vitest";
import { llmJudge } from "./llm-judge.js";

const { runContent } = vi.hoisted(() => ({ runContent: vi.fn() }));
vi.mock("../runtime/dispatch.js", () => ({ runContent }));

describe("judge response validation", () => {
  it("rejects a missing criterion", async () => {
    runContent.mockResolvedValue({ isError: false, text: JSON.stringify({ results: [] }) });
    await expect(llmJudge("actual output", ["criterion"])).rejects.toThrow();
  });
  it("rejects fabricated evidence", async () => {
    runContent.mockResolvedValue({ isError: false, text: JSON.stringify({ results: [{ practice: "criterion", passed: true, evidence: "invented" }] }) });
    await expect(llmJudge("actual output", ["criterion"])).rejects.toThrow();
  });
  it("accepts a complete grounded verdict", async () => {
    runContent.mockResolvedValue({ isError: false, text: JSON.stringify({ results: [{ practice: "criterion", passed: true, evidence: "actual" }] }) });
    await expect(llmJudge("actual output", ["criterion"])).resolves.toMatchObject({ passed: 1, total: 1 });
  });
});
