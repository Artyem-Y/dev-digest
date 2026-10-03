import type { RepoRef } from '@devdigest/shared';
import type { RepoBasics } from './repository.js';
import type { IndexResult } from './types.js';
import type { RepoIntelIndexerPort } from './indexer.js';

export interface RepoIntelBasicsPort {
  getRepoBasics(repoId: string): Promise<RepoBasics | null>;
}

export interface RepoIntelGitPort {
  sync(repo: RepoRef, branch: string): Promise<{ head: string }>;
}

/** Application commands for the synchronous full, incremental, and resync flows. */
export class RepoIntelIndexCommands {
  constructor(
    private readonly repository: RepoIntelBasicsPort,
    private readonly git: RepoIntelGitPort,
    private readonly indexer: RepoIntelIndexerPort,
    private readonly now: () => number = Date.now,
  ) {}

  full(repoId: string): Promise<IndexResult> {
    return this.indexer.full(repoId);
  }

  refresh(repoId: string): Promise<IndexResult> {
    return this.indexer.incremental(repoId);
  }

  async resync(repoId: string): Promise<IndexResult> {
    const startedAt = this.now();
    const repo = await this.repository.getRepoBasics(repoId);
    if (!repo || !repo.clonePath) return this.degraded(startedAt, 'no_clone');
    try {
      await this.git.sync({ owner: repo.owner, name: repo.name }, repo.defaultBranch);
    } catch (error) {
      return this.degraded(startedAt, `sync_failed:${error instanceof Error ? error.message : String(error)}`);
    }
    return this.indexer.incremental(repoId);
  }

  private degraded(startedAt: number, reason: string): IndexResult {
    return { status: 'degraded', filesIndexed: 0, filesSkipped: 0, durationMs: this.now() - startedAt, reason };
  }
}
