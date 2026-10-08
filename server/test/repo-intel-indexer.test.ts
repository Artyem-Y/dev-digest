import { describe, expect, it, vi } from 'vitest';
import { RepoIntelService } from '../src/modules/repo-intel/service.js';
import { RepoIntelRepository } from '../src/modules/repo-intel/repository.js';
import { RepoIntelIndexCommands } from '../src/modules/repo-intel/index-commands.js';

describe('RepoIntelService indexing boundary', () => {
  it('delegates full and incremental indexing to its injected worker port', async () => {
    const indexer = {
      full: vi.fn().mockResolvedValue({ status: 'ready', filesIndexed: 4, filesSkipped: 0, durationMs: 12 }),
      incremental: vi.fn().mockResolvedValue({ status: 'ready', filesIndexed: 1, filesSkipped: 0, durationMs: 3 }),
    };
    const repository = new RepoIntelRepository({} as never);
    const service = new RepoIntelService({
      repository,
      enabled: true,
      codeIndex: {} as never,
      jobs: { register: vi.fn(), enqueue: vi.fn() },
      indexCommands: new RepoIntelIndexCommands(repository, { sync: vi.fn() }, indexer),
    });

    await expect(service.indexRepo('repo-1')).resolves.toMatchObject({ filesIndexed: 4 });
    await expect(service.refreshIndex('repo-1')).resolves.toMatchObject({ filesIndexed: 1 });
    expect(indexer.full).toHaveBeenCalledWith('repo-1');
    expect(indexer.incremental).toHaveBeenCalledWith('repo-1');
  });
});
