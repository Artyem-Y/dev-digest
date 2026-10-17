import type { ReviewRecord } from "@devdigest/shared";
export { latestFindingsPerAgent } from "@/lib/review-findings";
import {
  FINDINGS_SEVERITIES,
  SIZE_MEDIUM_MAX,
  SIZE_SMALL_MAX,
  type PrMeta,
  type SizeInfo,
} from "./constants";

/**
 * Findings from each agent's current review. This mirrors the API's list
 * aggregation, so a hover preview always represents exactly the shown chips.
 */
/** Bucket a PR into S/M/L by total changed lines. */
export function sizeOf(pr: PrMeta): SizeInfo {
  const lines = pr.additions + pr.deletions;
  const size = lines < SIZE_SMALL_MAX ? "S" : lines < SIZE_MEDIUM_MAX ? "M" : "L";
  return { size, lines };
}

/** Compact relative time for the list's UPDATED column (e.g. "3h", "2d"). */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const m = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
