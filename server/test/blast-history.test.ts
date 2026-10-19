import { describe, expect, it, vi } from 'vitest';
import { BlastService } from '../src/modules/blast/service.js';

describe('BlastService prior merged PR history', () => {
  it('returns the three newest earlier merged PRs that overlap changed files', async () => {
    const listRecentMergedPullRequests = vi.fn().mockResolvedValue([
      { number: 9, title: 'Newest overlap', author: 'zoe', mergedAt: '2026-10-19T10:00:00Z', files: ['src/limit.ts'] },
      { number: 8, title: 'No overlap', author: 'li', mergedAt: '2026-10-18T10:00:00Z', files: ['docs/readme.md'] },
      { number: 7, title: 'Second overlap', author: 'ana', mergedAt: '2026-10-17T10:00:00Z', files: ['src/limit.ts', 'src/api.ts'] },
      { number: 6, title: 'Third overlap', author: 'ben', mergedAt: '2026-10-16T10:00:00Z', files: ['src/api.ts'] },
      { number: 5, title: 'Excluded fourth overlap', author: 'cam', mergedAt: '2026-10-15T10:00:00Z', files: ['src/limit.ts'] },
    ]);
    const service = new BlastService(
      {
        findPullSnapshot: vi.fn().mockResolvedValue({
          repoId: 'repo-1', owner: 'acme', name: 'payments', pullNumber: 10,
          changedFiles: ['src/limit.ts', 'src/api.ts'],
        }),
      },
      { getBlastRadius: vi.fn().mockResolvedValue({ changedSymbols: [], callers: [], impactedEndpoints: [], degraded: false }) },
      { listRecentMergedPullRequests },
    );

    const result = await service.get('workspace-1', 'pull-1');

    expect(listRecentMergedPullRequests).toHaveBeenCalledWith({ owner: 'acme', name: 'payments' });
    expect(result.prior_prs).toEqual({
      history: [
        { pr_number: 9, title: 'Newest overlap', author: 'zoe', merged_at: '2026-10-19T10:00:00Z', files_overlap: ['src/limit.ts'], notes: '' },
        { pr_number: 7, title: 'Second overlap', author: 'ana', merged_at: '2026-10-17T10:00:00Z', files_overlap: ['src/api.ts', 'src/limit.ts'], notes: '' },
        { pr_number: 6, title: 'Third overlap', author: 'ben', merged_at: '2026-10-16T10:00:00Z', files_overlap: ['src/api.ts'], notes: '' },
      ],
    });
  });
});
