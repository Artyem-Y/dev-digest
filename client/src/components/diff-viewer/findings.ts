import type { FindingRecord } from '@devdigest/shared';

export interface PartitionedFindings {
  matched: Map<string, FindingRecord[]>;
  unmatched: FindingRecord[];
}

/** A finding may attach only to the new/right side of a rendered diff line. */
export function partitionFindings(
  findings: readonly FindingRecord[],
  path: string,
  renderedKeys: ReadonlySet<string>,
): PartitionedFindings {
  const matched = new Map<string, FindingRecord[]>();
  const unmatched: FindingRecord[] = [];
  for (const finding of findings) {
    if (finding.file !== path) continue;
    const key = `RIGHT:${finding.start_line}`;
    if (!renderedKeys.has(key)) {
      unmatched.push(finding);
      continue;
    }
    matched.set(key, [...(matched.get(key) ?? []), finding]);
  }
  return { matched, unmatched };
}
