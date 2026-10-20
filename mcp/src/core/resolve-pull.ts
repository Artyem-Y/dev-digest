import type { DevDigestApi, Pull, Repo } from '../http-client.js';

export async function resolvePull(api: DevDigestApi, repository: Repo, number: number): Promise<Pull> {
  const pulls = await api.listPulls(repository.id);
  const pull = pulls.find((candidate) => candidate.number === number);
  if (!pull) throw new Error(`PR #${number} was not found in ${repository.full_name}. Use GitHub MCP or gh to verify the PR number, then retry.`);
  return pull;
}
