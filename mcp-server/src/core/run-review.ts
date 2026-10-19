import type { DevDigestApi, RunFindings } from '../http-client.js';

const POLL_INTERVAL_MS = 1_000;

export async function runReviewAndWait(
  api: DevDigestApi,
  pullId: string,
  agentId: string,
  options: { sleep?: (milliseconds: number) => Promise<void> } = {},
): Promise<RunFindings> {
  const started = await api.runReview(pullId, agentId);
  const run = started.runs.find((candidate) => candidate.agent_id === agentId);
  if (!run) throw new Error('DevDigest did not create a run for the selected agent. Retry after calling devdigest_list_agents.');
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  while (true) {
    const result = await api.getRunFindings(run.run_id);
    if (result.status !== 'running') return result;
    await sleep(POLL_INTERVAL_MS);
  }
}
