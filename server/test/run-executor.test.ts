import { describe, expect, it, vi } from 'vitest';
import { ReviewRunExecutor } from '../src/modules/reviews/run-executor.js';

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

  it('does not wait for a pending intent derivation after the diff is ready', async () => {
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

    await expect(running).resolves.toBeUndefined();
    intent.resolve({ status: 'unavailable', reasonCode: 'model_unavailable', trace: { sourceCount: 0 } });
  });
});
