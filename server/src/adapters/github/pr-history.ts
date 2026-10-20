import type { GitHubClient, MergedPullRequest, RepoRef } from '@devdigest/shared';
import type { PriorMergedPullsPort } from '../../modules/blast/service.js';

/** Outbound GitHub adapter for an optional, bounded read of merged PR history. */
export class GitHubPriorMergedPullsAdapter implements PriorMergedPullsPort {
  constructor(private readonly resolveGitHub: () => Promise<GitHubClient>) {}

  async listRecentMergedPullRequests(repo: RepoRef): Promise<MergedPullRequest[] | null> {
    try {
      return await (await this.resolveGitHub()).listRecentMergedPullRequests(repo);
    } catch {
      return null;
    }
  }
}
