import { describe, expect, it, vi } from 'vitest';
import { IndexStateService } from '../src/modules/repo-intel/index-state.js';

describe('IndexStateService', () => {
  it('returns a JSON-safe degraded state when the repository has no index row', async () => {
    const repository = { tryGetIndexState: vi.fn().mockResolvedValue(null) };
    const service = new IndexStateService(repository, 3);

    await expect(service.get('repo-1')).resolves.toMatchObject({
      repoId: 'repo-1',
      status: 'degraded',
      lastIndexedSha: '',
      indexerVersion: 3,
      degraded: true,
      degradedReason: 'no_data',
    });
  });
});
