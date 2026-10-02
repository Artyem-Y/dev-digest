import { describe, expect, it, vi } from 'vitest';
import { RepoIntelService } from '../src/modules/repo-intel/service.js';
import { RepoIntelRepository } from '../src/modules/repo-intel/repository.js';
import { RepoIntelIndexCommands } from '../src/modules/repo-intel/index-commands.js';
import { RESYNC_JOB_KIND } from '../src/modules/repo-intel/constants.js';

describe('RepoIntelService job boundary', () => {
  it('returns a queued resync job identifier through its jobs port', async () => {
    const jobs = { register: vi.fn(), enqueue: vi.fn().mockResolvedValue({ id: 'job-1' }) };
    const repository = new RepoIntelRepository({} as never);
    const service = new RepoIntelService({
      repository,
      enabled: true,
      codeIndex: {} as never,
      jobs,
      indexCommands: new RepoIntelIndexCommands(repository, { sync: vi.fn() }, { full: vi.fn(), incremental: vi.fn() }),
    });

    await expect(service.enqueueResync('workspace-1', 'repo-1')).resolves.toBe('job-1');
    expect(jobs.enqueue).toHaveBeenCalledWith('workspace-1', RESYNC_JOB_KIND, { repoId: 'repo-1' });
  });
});
