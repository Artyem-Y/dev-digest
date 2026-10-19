import { describe, expect, it, vi } from 'vitest';
import { runReviewAndWait } from '../src/core/run-review.js';

describe('runReviewAndWait', () => {
  it('polls until it returns the persisted terminal result', async () => {
    const api = {
      runReview: vi.fn().mockResolvedValue({ runs: [{ run_id: 'run-1', agent_id: 'agent-1', agent_name: 'Security' }] }),
      getRunFindings: vi.fn()
        .mockResolvedValueOnce({ run_id: 'run-1', status: 'running', error: null, verdict: null, summary: null, score: null, findings: [] })
        .mockResolvedValueOnce({ run_id: 'run-1', status: 'done', error: null, verdict: 'approve', summary: 'Looks good.', score: 100, findings: [] }),
    };
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(runReviewAndWait(api as never, 'pull-1', 'agent-1', { sleep }))
      .resolves.toMatchObject({ status: 'done', run_id: 'run-1', verdict: 'approve' });

    expect(api.runReview).toHaveBeenCalledTimes(1);
    expect(api.getRunFindings).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it('rejects a start response that does not include the requested agent run', async () => {
    const api = {
      runReview: vi.fn().mockResolvedValue({ runs: [] }),
      getRunFindings: vi.fn(),
    };

    await expect(runReviewAndWait(api as never, 'pull-1', 'agent-1'))
      .rejects.toThrow('did not create a run');
  });
});
