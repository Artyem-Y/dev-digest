import type { DevDigestApi, RunFindings } from '../http-client.js';

export const REVIEW_WAIT_MS = 600_000;

export async function runReviewAndWait(
  api: DevDigestApi,
  pullId: string,
  agentId: string,
  options: {
    maxWaitMs?: number;
    now?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
    onProgress?: (progress: { progress: number; message: string }) => Promise<void>;
  } = {},
): Promise<RunFindings | { status: 'running'; run_id: string }> {
  const started = await api.runReview(pullId, agentId);
  const run = started.runs.find((candidate) => candidate.agent_id === agentId);
  if (!run) throw new Error('DevDigest did not create a run for the selected agent. Retry after calling devdigest_list_agents.');
  const maxWaitMs = options.maxWaitMs ?? REVIEW_WAIT_MS;
  const now = options.now ?? Date.now;
  const deadline = now() + maxWaitMs;
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let progress = 0;
  while (true) {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) return { status: 'running', run_id: run.run_id };
    const result = await api.getRunFindings(run.run_id, { timeoutMs: remainingMs });
    if (result.status !== 'running') return result;
    if (now() >= deadline) return { status: 'running', run_id: run.run_id };
    progress += 1;
    await options.onProgress?.({ progress, message: 'DevDigest review is still running.' });
    await sleep(Math.min(pollDelay(progress), deadline - now()));
  }
}

function pollDelay(pollCount: number): number {
  if (pollCount <= 5) return 1_000;
  if (pollCount <= 10) return 5_000;
  return 15_000;
}
