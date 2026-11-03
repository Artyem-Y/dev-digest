import { describe, expect, it, vi } from 'vitest';
import { runSuite, type EvalAgentSnapshot, type EvalCaseSnapshot } from '../src/modules/evals/application/run-suite.js';

const agent: EvalAgentSnapshot = { systemPrompt: 'review', provider: 'test', model: 'test', strategy: 'single-pass', skills: [] };
const evalCase: EvalCaseSnapshot = { id: '1', expectation: 'must_find', anchor: { file: 'a', startLine: 1, endLine: 1 }, fixtureId: 'fixture', fixtureHash: 'hash' };

describe('eval suite runner', () => {
  it('executes snapshots in order and preserves unknown costs', async () => {
    const review = vi.fn().mockResolvedValueOnce({ grounded: [evalCase.anchor], dropped: 1, costUsd: 0.1 })
      .mockResolvedValueOnce({ grounded: [], dropped: 0, costUsd: null });
    const result = await runSuite({ review }, agent, [evalCase, { ...evalCase, id: '2' }]);
    expect(review.mock.calls.map(([input]) => input.evalCase.id)).toEqual(['1', '2']);
    expect(result).toMatchObject({ status: 'completed', costUsd: null, score: { recall: 0.5, citationAccuracy: 0.5 } });
  });

  it('does not publish aggregate metrics when any case fails', async () => {
    const result = await runSuite({ review: async () => { throw new Error('secret provider detail'); } }, agent, [evalCase]);
    expect(result).toMatchObject({ status: 'failed', score: null, costUsd: null, results: [{ error: 'review_failed' }] });
    expect(JSON.stringify(result)).not.toContain('secret provider detail');
  });

  it('aborts and marks a timed out case without exposing a partial score', async () => {
    let signal: AbortSignal | undefined;
    const result = await runSuite({ review: async (input) => { signal = input.signal; return new Promise((_, reject) => input.signal.addEventListener('abort', () => reject(new Error('aborted')))); } }, agent, [evalCase], 5);
    expect(signal?.aborted).toBe(true);
    expect(result).toMatchObject({ status: 'failed', score: null, results: [{ error: 'timeout' }] });
  });

  it('keeps the suite active until a provider that ignores cancellation settles', async () => {
    let settle!: () => void;
    const pending = new Promise<void>((resolve) => { settle = resolve; });
    let finished = false;
    const execution = runSuite({ review: async () => { await pending; return { grounded: [], dropped: 0, costUsd: null }; } }, agent, [evalCase], 5).then((value) => { finished = true; return value; });
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(finished).toBe(false);
    settle();
    expect(await execution).toMatchObject({ status: 'failed', results: [{ error: 'timeout' }] });
  });
});
