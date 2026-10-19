import type { DevDigestApi, Repo } from '../http-client.js';

export async function resolveRepository(api: DevDigestApi, locator: string): Promise<Repo> {
  const normalized = locator.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  const repositories = await api.listRepos();
  const exact = repositories.filter((repo) => repo.id === normalized || repo.full_name === normalized || `${repo.owner}/${repo.name}` === normalized);
  if (exact.length === 1) return exact[0]!;
  const byName = normalized.includes('/') ? [] : repositories.filter((repo) => repo.name === normalized);
  if (byName.length === 1) return byName[0]!;
  if (exact.length > 1 || byName.length > 1) {
    throw new Error(`Repository "${locator}" is ambiguous. Use owner/name from GitHub MCP or gh.`);
  }
  throw new Error(`Repository "${locator}" is not configured in DevDigest. Use GitHub MCP or gh to find the canonical owner/name, then import it into DevDigest.`);
}
