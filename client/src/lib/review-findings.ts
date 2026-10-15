import { selectLatestReviewsPerAgent } from '@/vendor/shared/review-selection';
import type { FindingRecord, ReviewRecord } from '@/vendor/shared/contracts/review-api';
import { FINDINGS_SEVERITIES } from '@/app/repos/[repoId]/pulls/constants';

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
