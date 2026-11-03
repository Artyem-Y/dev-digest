import { describe, expect, test } from "vitest";
import { alignTestSeries, logicalTestKey } from "./test-identity.js";
import type { NodeAggregate } from "./stats.js";

const aggregate = (nodeid: string): NodeAggregate => ({
  nodeid,
  label: "case",
  pass: { passed: 1, total: 1, rate: 1 },
  practices: {},
  metrics: {
    durationMs: { mean: 1, stddev: 0, min: 1, max: 1, n: 1 },
    inputTokens: { mean: 1, stddev: 0, min: 1, max: 1, n: 1 },
    outputTokens: { mean: 1, stddev: 0, min: 1, max: 1, n: 1 },
    numTurns: { mean: 1, stddev: 0, min: 1, max: 1, n: 1 },
    toolCallCount: { mean: 1, stddev: 0, min: 1, max: 1, n: 1 },
  },
});

describe("logical eval identity", () => {
  test("uses the leaf test title across different agent files and describe labels", () => {
    const strict = "agents/architecture-reviewer.eval.ts > agent:architecture-reviewer > cites rule";
    const lite = "agents/architecture-reviewer-lite.eval.ts > agent:architecture-reviewer-lite > cites rule";
    expect(logicalTestKey(strict)).toBe("cites rule");
    expect(alignTestSeries({ [strict]: aggregate(strict) })).toHaveProperty("cites rule");
    expect(alignTestSeries({ [lite]: aggregate(lite) })).toHaveProperty("cites rule");
  });

  test("fails clearly when a series has ambiguous duplicate leaf titles", () => {
    const one = "agents/one.eval.ts > agent:one > same case";
    const two = "agents/two.eval.ts > agent:two > same case";
    expect(() => alignTestSeries({ [one]: aggregate(one), [two]: aggregate(two) })).toThrow(
      "multiple tests share leaf title 'same case'",
    );
  });
});
