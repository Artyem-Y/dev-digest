import { describe, expect, test } from "vitest";
import { normalizeReadPath } from "./run-claude.js";

describe("workflow trace paths", () => {
  test("normalizes Windows separators for stable fixture matching", () => {
    expect(normalizeReadPath("server\\AGENTS.md")).toBe("server/AGENTS.md");
  });
});
