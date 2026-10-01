import { describe, expect, it, vi } from 'vitest';
import {
  PullsService,
  type PullsRepositoryPort,
  type PullRow,
  type PullRepositoryRow,
} from '../src/modules/pulls/service.js';

const repo: PullRepositoryRow = {
  id: 'repo-1',
  owner: 'acme',
  name: 'payments-api',
};

const pull: PullRow = {
  id: 'pull-1',
  workspaceId: 'workspace-1',
  repoId: repo.id,
  number: 482,
  title: 'Add rate limiting',
  author: 'marisa.koch',
  branch: 'feature/rate-limit',
  base: 'main',
  headSha: 'head-sha',
  additions: 4,
  deletions: 2,
  filesCount: 1,
  status: 'open',
  body: 'Persisted PR body',
  openedAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-02T00:00:00Z'),
  lastReviewedSha: null,
};

function repository(): PullsRepositoryPort {
  return {
    findRepo: vi.fn().mockResolvedValue(repo),
    listPulls: vi.fn().mockResolvedValue([pull]),
    upsertPull: vi.fn(),
    updateStats: vi.fn(),
    latestReviewScores: vi.fn().mockResolvedValue(new Map()),
    latestCosts: vi.fn().mockResolvedValue(new Map()),
    findPullWithRepo: vi.fn().mockResolvedValue({ pull, repo }),
    replaceSnapshot: vi.fn(),
    persistedDetail: vi.fn().mockResolvedValue({ pull, files: [], commits: [] }),
    findPullAndRepo: vi.fn().mockResolvedValue({ pull, repo }),
  };
}

describe('PullsService local-first reads', () => {
  it('returns persisted pull-list rows when the GitHub client is unavailable', async () => {
    const store = repository();
    const service = new PullsService(store, async () => {
      throw new Error('GITHUB_TOKEN is not configured');
    });

    await expect(service.list('workspace-1', repo.id)).resolves.toEqual([
      expect.objectContaining({
        id: pull.id,
        number: pull.number,
        status: 'needs_review',
        cost_usd: null,
      }),
    ]);
    expect(store.listPulls).toHaveBeenCalledWith(repo.id);
  });

  it('returns the persisted detail snapshot when GitHub detail refresh is unavailable', async () => {
    const store = repository();
    const service = new PullsService(store, async () => {
      throw new Error('GITHUB_TOKEN is not configured');
    });

    await expect(service.detail('workspace-1', pull.id)).resolves.toMatchObject({
      id: pull.id,
      number: pull.number,
      body: pull.body,
      files: [],
      commits: [],
    });
    expect(store.persistedDetail).toHaveBeenCalledWith(pull.id);
  });
});
