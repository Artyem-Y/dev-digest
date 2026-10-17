import { describe, expect, it, vi } from 'vitest';
import { REVIEW_INTENT_DEADLINE_MS, ReviewRunExecutor } from '../src/modules/reviews/run-executor.js';

describe('ReviewRunExecutor', () => {
  it('starts intent derivation while the PR diff is loading', async () => {
    const diff = Promise.withResolvers<{ raw: string; files: [] }>();
    const deriveIntent = vi.fn().mockResolvedValue({
      status: 'unavailable', reasonCode: 'model_unavailable', trace: { sourceCount: 0 },
    });
    const executor = new ReviewRunExecutor({
      runBus: {},
      loadDiff: vi.fn().mockReturnValue(diff.promise),
      deriveIntent,
    } as never, {} as never);

    const running = executor.executeRuns(
      'workspace',
      { id: 'pull', title: 'Title', body: null } as never,
      { owner: 'acme', name: 'repo' },
      [],
    );

    await vi.waitFor(() => expect(deriveIntent).toHaveBeenCalledOnce());
    diff.resolve({ raw: '', files: [] });
    await expect(running).resolves.toBeUndefined();
  });

  it('continues after the intent deadline while derivation completes in the background', async () => {
    vi.useFakeTimers();
    try {
      const intent = Promise.withResolvers<{ status: 'unavailable'; reasonCode: 'model_unavailable'; trace: { sourceCount: number } }>();
      const executor = new ReviewRunExecutor({
        runBus: {},
        loadDiff: vi.fn().mockResolvedValue({ raw: '', files: [] }),
        deriveIntent: vi.fn().mockReturnValue(intent.promise),
      } as never, {} as never);

      const running = executor.executeRuns(
        'workspace',
        { id: 'pull', title: 'Title', body: null } as never,
        { owner: 'acme', name: 'repo' },
        [],
      );

      await vi.advanceTimersByTimeAsync(REVIEW_INTENT_DEADLINE_MS);
      await expect(running).resolves.toBeUndefined();
      intent.resolve({ status: 'unavailable', reasonCode: 'model_unavailable', trace: { sourceCount: 0 } });
    } finally {
      vi.useRealTimers();
    }
  });
});
