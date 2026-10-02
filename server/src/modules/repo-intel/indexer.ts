import type { Container } from '../../platform/container.js';
import { RepoIntelRepository } from './repository.js';
import type { IndexResult } from './types.js';
import { runFullIndex } from './pipeline/full.js';
import { runIncremental } from './pipeline/incremental.js';

export interface RepoIntelIndexerPort {
  full(repoId: string): Promise<IndexResult>;
  incremental(repoId: string): Promise<IndexResult>;
}

/** Infrastructure adapter that binds the indexing pipelines to runtime services. */
export class RepoIntelIndexer implements RepoIntelIndexerPort {
  constructor(
    private readonly container: Container,
    private readonly repository: RepoIntelRepository,
  ) {}

  full(repoId: string): Promise<IndexResult> {
    return runFullIndex(this.container, this.repository, { repoId });
  }

  incremental(repoId: string): Promise<IndexResult> {
    return runIncremental(this.container, this.repository, { repoId });
  }
}
