import { scoreCases, type Anchor, type EvalScore } from '../domain/score.js';

/** A case and its complete frozen input, owned by a persisted suite snapshot. */
export interface EvalCaseSnapshot {
  id: string;
  expectation: 'must_find' | 'must_not_flag';
  anchor: Anchor;
  fixtureId: string;
  fixtureHash: string;
  diff?: string;
}

export interface EvalAgentSnapshot {
  systemPrompt: string;
  provider: string;
  model: string;
  strategy: 'auto' | 'single-pass' | 'map-reduce';
  skills: string[];
}

export interface EvalExecutionPort {
  review(input: { agent: EvalAgentSnapshot; evalCase: EvalCaseSnapshot; signal: AbortSignal }): Promise<{
    grounded: Anchor[];
    dropped: number;
    costUsd: number | null;
  }>;
}

export type EvalCaseResult =
  | { caseId: string; status: 'completed'; grounded: Anchor[]; dropped: number; costUsd: number | null; durationMs: number }
  | { caseId: string; status: 'failed'; error: 'review_failed' | 'timeout'; durationMs: number };

export interface SuiteResult {
  status: 'completed' | 'failed';
  results: EvalCaseResult[];
  score: EvalScore | null;
  costUsd: number | null;
}

/** Execute sequentially; no partial score is published for an incomplete suite. */
export async function runSuite(
  execution: EvalExecutionPort,
  agent: EvalAgentSnapshot,
  cases: readonly EvalCaseSnapshot[],
  timeoutMs = 120_000,
): Promise<SuiteResult> {
  if (cases.length === 0 || cases.length > 100) throw new RangeError('Suite must contain 1–100 cases');
  const results: EvalCaseResult[] = [];
  for (const evalCase of cases) {
    const start = Date.now();
    const controller = new AbortController();
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      // Retain the suite slot until the provider settles, even if it ignores
      // cancellation. A timer alone cannot stop an in-flight network request.
      const result = await execution.review({ agent, evalCase, signal: controller.signal });
      if (timedOut) throw new Error('timeout');
      results.push({ caseId: evalCase.id, status: 'completed', ...result, durationMs: Date.now() - start });
    } catch {
      results.push({ caseId: evalCase.id, status: 'failed', error: timedOut ? 'timeout' : 'review_failed', durationMs: Date.now() - start });
      // An adapter may be unable to interrupt its underlying provider request.
      // Do not start another request after a failure or timeout.
      break;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  if (results.some((result) => result.status === 'failed')) return { status: 'failed', results, score: null, costUsd: null };
  const completed = results as Extract<EvalCaseResult, { status: 'completed' }>[];
  return {
    status: 'completed', results,
    score: scoreCases(completed.map((result, index) => ({
      expectation: cases[index]!.expectation, anchor: cases[index]!.anchor,
      grounded: result.grounded, dropped: result.dropped,
    }))),
    costUsd: completed.every((result) => result.costUsd !== null)
      ? completed.reduce((sum, result) => sum + result.costUsd!, 0) : null,
  };
}
