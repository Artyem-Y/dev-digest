import type { IndexState } from './types.js';

export interface IndexStateRepositoryPort {
  tryGetIndexState(repoId: string): Promise<IndexState | null>;
}

/** Application use case for the JSON-safe repository-index status contract. */
export class IndexStateService {
  constructor(
    private readonly repository: IndexStateRepositoryPort,
    private readonly indexerVersion: number,
  ) {}

  async get(repoId: string): Promise<IndexState> {
    const persisted = await this.repository.tryGetIndexState(repoId);
    if (persisted) return persisted;
    return {
      repoId,
      status: 'degraded',
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: 0,
      reason: 'no_data',
      lastIndexedSha: '',
      indexerVersion: this.indexerVersion,
      updatedAt: new Date(0),
      degraded: true,
      degradedReason: 'no_data',
    };
  }
}
