import type { NodeAggregate } from "./stats.js";

/**
 * Keep only the leaf test title so strict/lite agents (or snapshots at different paths) align
 * when they run the same curated cases under different describe/file names.
 */
export function logicalTestKey(nodeid: string): string {
  return nodeid.split(" > ").filter(Boolean).at(-1) ?? nodeid;
}

/** Re-key a series for A/B comparison and reject ambiguous duplicate leaf titles. */
export function alignTestSeries(
  tests: Record<string, NodeAggregate>,
): Record<string, NodeAggregate> {
  const aligned: Record<string, NodeAggregate> = {};
  for (const [nodeid, aggregate] of Object.entries(tests)) {
    const key = logicalTestKey(nodeid);
    if (Object.hasOwn(aligned, key)) {
      throw new Error(
        `Cannot align repeated eval series: multiple tests share leaf title '${key}' (${aligned[key].nodeid}; ${nodeid})`,
      );
    }
    aligned[key] = aggregate;
  }
  return aligned;
}
