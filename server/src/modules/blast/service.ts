import type { BlastRadius, MergedPullRequest, RepoRef } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import type { RepoIntel } from '../repo-intel/types.js';
import { mapBlastResult } from './application/map-blast-radius.js';
import type { BlastPullSnapshot } from './repository.js';

export interface BlastPullSnapshotPort {
  findPullSnapshot(workspaceId: string, pullId: string): Promise<BlastPullSnapshot | undefined>;
}

export interface PriorMergedPullsPort {
  listRecentMergedPullRequests(repo: RepoRef): Promise<MergedPullRequest[] | null>;
}

const HISTORY_RESULT_LIMIT = 3;

export class BlastService {
  constructor(
    private readonly repository: BlastPullSnapshotPort,
    private readonly repoIntel: Pick<RepoIntel, 'getBlastRadius'>,
    private readonly priorMergedPulls: PriorMergedPullsPort,
  ) {}

  async get(workspaceId: string, pullId: string): Promise<BlastRadius> {
    const snapshot = await this.repository.findPullSnapshot(workspaceId, pullId);
    if (!snapshot) throw new NotFoundError('Pull request not found');
    const [blast, priorPulls] = await Promise.all([
      this.repoIntel.getBlastRadius(snapshot.repoId, snapshot.changedFiles),
      this.priorMergedPulls.listRecentMergedPullRequests({ owner: snapshot.owner, name: snapshot.name }),
    ]);
    return {
      ...mapBlastResult(blast),
      prior_prs: priorPulls === null ? null : { history: selectPriorPulls(priorPulls, snapshot) },
    };
  }
}

function selectPriorPulls(pulls: MergedPullRequest[], snapshot: BlastPullSnapshot): NonNullable<BlastRadius['prior_prs']>['history'] {
  const changedFiles = new Set(snapshot.changedFiles);
  return pulls
    .filter((pull) => pull.number !== snapshot.pullNumber)
    .map((pull) => ({
      pull,
      filesOverlap: pull.files.filter((file) => changedFiles.has(file)).sort(),
    }))
    .filter(({ filesOverlap }) => filesOverlap.length > 0)
    .sort((left, right) => right.pull.mergedAt.localeCompare(left.pull.mergedAt))
    .slice(0, HISTORY_RESULT_LIMIT)
    .map(({ pull, filesOverlap }) => ({
      pr_number: pull.number,
      title: pull.title,
      merged_at: pull.mergedAt,
      author: pull.author,
      files_overlap: filesOverlap,
      notes: '',
    }));
}
