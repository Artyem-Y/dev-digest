import { selectLatestReviewsPerAgent } from '@/vendor/shared/review-selection';
import type { FindingRecord, ReviewRecord } from '@/vendor/shared/contracts/review-api';
import { FINDINGS_SEVERITIES } from '@/app/repos/[repoId]/pulls/constants';

/** Compare repository paths independently of common unified-diff prefixes. */
function repositoryPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^(?:\.\/|[ab]\/)+/, '');
}

/** Findings from each agent's current review, sorted by review severity. */
export function latestFindingsPerAgent(reviews: ReviewRecord[]): FindingRecord[] {
  const rank = (severity: string) => {
    const index = FINDINGS_SEVERITIES.indexOf(severity as (typeof FINDINGS_SEVERITIES)[number]);
    return index === -1 ? FINDINGS_SEVERITIES.length : index;
  };
  return selectLatestReviewsPerAgent(reviews)
    .flatMap((review) => review.findings)
    .sort((a, b) => rank(a.severity) - rank(b.severity));
}

/**
 * Keeps findings owned by a Smart Diff group and rewrites only their display
 * path to the PR-file path. Review output may use a/ or b/ diff prefixes,
 * while the pull-files endpoint stores repository-relative paths.
 */
export function findingsForFiles(files: readonly { path: string }[], findings: readonly FindingRecord[]): FindingRecord[] {
  const filesByPath = new Map(files.map((file) => [repositoryPath(file.path), file.path]));
  return findings.flatMap((finding) => {
    const path = filesByPath.get(repositoryPath(finding.file));
    if (!path) return [];
    return path === finding.file ? [finding] : [{ ...finding, file: path }];
  });
}
