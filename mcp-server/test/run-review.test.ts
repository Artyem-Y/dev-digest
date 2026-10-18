import { describe, expect, it, vi } from 'vitest';
import { runReviewAndWait } from '../src/core/run-review.js';

const running = {
  run_id: 'run-1', status: 'running' as const, error: null, verdict: null, summary: null, score: null, findings: [],
};

describe('runReviewAndWait', () => {
  it('does not poll when the review wait deadline has already elapsed', async () => {
    const api = {
      runReview: vi.fn().mockResolvedValue({ runs: [{ run_id: 'run-1', agent_id: 'agent-1', agent_name: 'Security' }] }),
      getFindings: vi.fn(),
    };

    await expect(runReviewAndWait(api as never, 'pull-1', 'agent-1', { maxWaitMs: 0, now: () => 1_000 }))
      .resolves.toEqual({ status: 'running', run_id: 'run-1' });

    expect(api.runReview).toHaveBeenCalledTimes(1);
    expect(api.getFindings).not.toHaveBeenCalled();
  });

  it('passes remaining time to a poll and makes no call after the absolute deadline', async () => {
    let currentTime = 1_000;
    const api = {
      runReview: vi.fn().mockResolvedValue({ runs: [{ run_id: 'run-1', agent_id: 'agent-1', agent_name: 'Security' }] }),
      getFindings: vi.fn().mockResolvedValue(running),
    };
    const sleep = vi.fn(async (milliseconds: number) => { currentTime += milliseconds; });

    await expect(runReviewAndWait(api as never, 'pull-1', 'agent-1', {
      maxWaitMs: 1_000,
      now: () => currentTime,
      sleep,
    })).resolves.toEqual({ status: 'running', run_id: 'run-1' });

    expect(api.getFindings).toHaveBeenCalledTimes(1);
    expect(api.getFindings).toHaveBeenCalledWith('run-1', { timeoutMs: 1_000 });
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it('returns running when a poll completes after the absolute deadline', async () => {
    let currentTime = 1_000;
    const api = {
      runReview: vi.fn().mockResolvedValue({ runs: [{ run_id: 'run-1', agent_id: 'agent-1', agent_name: 'Security' }] }),
      getFindings: vi.fn(async () => {
        currentTime = 2_001;
        return { ...running, status: 'done' as const, verdict: 'approve' as const, summary: 'Late result', score: 100 };
      }),
    };

    await expect(runReviewAndWait(api as never, 'pull-1', 'agent-1', {
      maxWaitMs: 1_000,
      now: () => currentTime,
    })).resolves.toEqual({ status: 'running', run_id: 'run-1' });
  });
});
