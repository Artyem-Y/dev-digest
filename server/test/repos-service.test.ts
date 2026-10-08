import { describe, expect, it, vi } from 'vitest';
import { RepoService } from '../src/modules/repos/service.js';

const storedRepo = {
  id: 'repo-1',
  workspaceId: 'workspace-1',
  owner: 'acme',
  name: 'payments-api',
  fullName: 'acme/payments-api',
  clonePath: null,
  defaultBranch: 'main',
  lastPolledAt: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-10-02T00:00:00Z'),
};

describe('RepoService', () => {
  it('creates a repo and enqueues its clone through injected ports', async () => {
    const repository = {
      findByFullName: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockResolvedValue(storedRepo),
      list: vi.fn(),
      getById: vi.fn(),
      workspaceIdFor: vi.fn(),
      updateClonePath: vi.fn(),
      remove: vi.fn(),
    };
    const jobs = { register: vi.fn(), enqueue: vi.fn().mockResolvedValue({ id: 'job-1' }) };
    const service = new RepoService({
      repository,
      jobs,
      secrets: { get: vi.fn() },
      git: { clone: vi.fn() },
    } as never);

    await expect(service.add('workspace-1', 'user-1', 'https://github.com/acme/payments-api.git')).resolves.toEqual({
      repo: expect.objectContaining({ id: storedRepo.id, full_name: storedRepo.fullName }),
      created: true,
    });
    expect(jobs.enqueue).toHaveBeenCalledWith('workspace-1', 'clone', {
      repoId: storedRepo.id,
      owner: storedRepo.owner,
      name: storedRepo.name,
      url: 'https://github.com/acme/payments-api.git',
    });
  });
});
