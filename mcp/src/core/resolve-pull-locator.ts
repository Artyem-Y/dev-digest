import type { DevDigestApi, Pull, Repo } from '../http-client.js';
import { resolveRepository } from './resolve-repository.js';

export type ResolvedPull = Pull & { repository: Repo | null };
const REPOSITORY_LOOKUP_CONCURRENCY = 5;

/** Resolve the PR locators exposed by MCP without making a GitHub request. */
export async function resolvePullLocator(
  api: DevDigestApi,
  prId: string,
  repositoryLocator?: string,
): Promise<ResolvedPull> {
  const normalized = prId.trim();
  if (isUuid(normalized)) return { id: normalized, number: 0, title: '', repository: null };

  const repositories = repositoryLocator
    ? [await resolveRepository(api, repositoryLocator)]
    : await api.listRepos();
  const pullLists = await mapInBatches(repositories, REPOSITORY_LOOKUP_CONCURRENCY, async (repository) => ({
    repository,
    pulls: await api.listPulls(repository.id),
  }));
  const matches = pullLists.flatMap(({ repository, pulls }) =>
    pulls.filter((pull) => matchesPull(pull, normalized)).map((pull) => ({ ...pull, repository })),
  );

  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(`Pull request "${prId}" is ambiguous across configured repositories. Provide repository as owner/name, then retry.`);
  }
  throw new Error(`Pull request "${prId}" was not found in configured DevDigest repositories. Provide repository as owner/name or use GitHub MCP or gh to verify it.`);
}

async function mapInBatches<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += concurrency) {
    results.push(...await Promise.all(items.slice(index, index + concurrency).map(mapper)));
  }
  return results;
}

function matchesPull(pull: Pull, locator: string): boolean {
  const number = /^#?(\d+)$/.exec(locator);
  if (number) return pull.number === Number(number[1]);
  return pull.title.toLocaleLowerCase().includes(locator.toLocaleLowerCase());
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
