import type { BlastRadius } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import type { RepoIntel } from '../repo-intel/types.js';
import { mapBlastResult } from './application/map-blast-radius.js';
import type { BlastPullSnapshot } from './repository.js';

export interface BlastPullSnapshotPort {
  findPullSnapshot(workspaceId: string, pullId: string): Promise<BlastPullSnapshot | undefined>;
}

export class BlastService {
  constructor(
    private readonly repository: BlastPullSnapshotPort,
    private readonly repoIntel: Pick<RepoIntel, 'getBlastRadius'>,
  ) {}

  async get(workspaceId: string, pullId: string): Promise<BlastRadius> {
    const snapshot = await this.repository.findPullSnapshot(workspaceId, pullId);
    if (!snapshot) throw new NotFoundError('Pull request not found');
    return mapBlastResult(await this.repoIntel.getBlastRadius(snapshot.repoId, snapshot.changedFiles));
  }
}
