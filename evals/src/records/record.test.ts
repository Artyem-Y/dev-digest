import { describe, expect, it, vi } from "vitest";
import { record } from "./record.js";
import type { Result } from "../runtime/run-claude.js";

const { append } = vi.hoisted(() => ({ append: vi.fn() }));
vi.mock("node:fs", async (load) => ({ ...(await load<typeof import("node:fs")>()), appendFileSync: append, mkdirSync: vi.fn(), writeFileSync: vi.fn() }));

describe("workflow records", () => {
  it("records a failed assertion even when the session succeeded", () => {
    const result = { isError: false, text: "done", toolsUsed: [], subagents: [], skillsInvoked: [], filesRead: [] } as unknown as Result;
    record("workflow case", { result, outcome: false });
    expect(JSON.parse(append.mock.calls.at(-1)![1]).outcome).toBe(false);
  });
});
