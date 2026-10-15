import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../src/platform/errors.js';
import { GetSmartDiff } from '../src/modules/reviews/smart-diff/application/get-smart-diff.js';

describe('GetSmartDiff', () => {
  it('rejects a missing scoped pull before reading files or reviews', async () => {
    const port = {
      getPull: vi.fn().mockResolvedValue(undefined),
      getPrFiles: vi.fn(),
      reviewsForPull: vi.fn(),
    };
    await expect(new GetSmartDiff(port).execute('workspace', 'pull')).rejects.toBeInstanceOf(NotFoundError);
    expect(port.getPrFiles).not.toHaveBeenCalled();
    expect(port.reviewsForPull).not.toHaveBeenCalled();
  });

  it('uses the current review from each agent and remains useful before review', async () => {
    const port = {
      getPull: vi.fn().mockResolvedValue({ id: 'pull' }),
      getPrFiles: vi.fn().mockResolvedValue([{ path: 'src/a.ts', additions: 2, deletions: 1 }]),
      reviewsForPull: vi.fn().mockResolvedValue([
        { review: { id: 'old', agentId: 'agent', kind: 'review', createdAt: new Date('2026-10-10T00:00:00Z') }, findings: [{ file: 'src/a.ts', startLine: 1 }] },
        { review: { id: 'new', agentId: 'agent', kind: 'review', createdAt: new Date('2026-10-11T00:00:00Z') }, findings: [] },
      ]),
    };
    const result = await new GetSmartDiff(port).execute('workspace', 'pull');
    expect(result.groups[0]!.files[0]!.finding_lines).toEqual([]);
    expect(result.split_suggestion.total_lines).toBe(3);
  });
});
