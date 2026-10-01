import type { GitHubClient } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import type { PollingRepositoryPort } from './repository.js';

export type GitHubResolver = () => Promise<GitHubClient>;

/** Application workflow for the explicit, manual PR-list synchronization. */
export class PollingService {
  constructor(private readonly repository: PollingRepositoryPort, private readonly github: GitHubResolver) {}

  async poll(workspaceId: string, repoId: string): Promise<{ synced: number; reviewTriggered: false }> {
    const repo = await this.repository.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    const pulls = await (await this.github()).listPullRequests({ owner: repo.owner, name: repo.name });
    for (const pull of pulls) await this.repository.upsertPull(workspaceId, repo.id, pull);
    await this.repository.markPolled(repo.id);
    return { synced: pulls.length, reviewTriggered: false };
  }
}
