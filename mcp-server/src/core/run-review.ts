import type { DevDigestApi, RunFindings } from '../http-client.js';

export const REVIEW_WAIT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

export async function runReviewAndWait(
  api: DevDigestApi,
  pullId: string,
  agentId: string,
  options: { maxWaitMs?: number; sleep?: (milliseconds: number) => Promise<void>; now?: () => number } = {},
): Promise<RunFindings | { status: 'running'; run_id: string }> {
  const started = await api.runReview(pullId, agentId);
  const run = started.runs.find((candidate) => candidate.agent_id === agentId);
  if (!run) throw new Error('DevDigest did not create a run for the selected agent. Retry after calling devdigest_list_agents.');

  const maxWaitMs = options.maxWaitMs ?? REVIEW_WAIT_MS;
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;
  const deadline = now() + maxWaitMs;
  while (true) {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) return { status: 'running', run_id: run.run_id };
    let result: RunFindings;
    try {
      result = await api.getRunFindings(run.run_id, { timeoutMs: remainingMs });
    } catch (error) {
      if (now() >= deadline) return { status: 'running', run_id: run.run_id };
      throw error;
    }
    if (now() >= deadline) return { status: 'running', run_id: run.run_id };
    if (result.status !== 'running') return result;
    const sleepMs = deadline - now();
    if (sleepMs > 0) await sleep(Math.min(POLL_INTERVAL_MS, sleepMs));
  }
}
