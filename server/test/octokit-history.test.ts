import { describe, expect, it, vi } from 'vitest';
import { OctokitGitHubClient } from '../src/adapters/github/octokit.js';

describe('OctokitGitHubClient merged PR history', () => {
  it('uses a bounded GraphQL PR list and paginates files into a cached history snapshot', async () => {
    const graphql = vi.fn().mockResolvedValue({
      repository: {
        pullRequests: {
          nodes: [{ number: 17, title: 'Harden limiter', mergedAt: '2026-10-19T10:00:00Z', author: { login: 'marisa' } }],
        },
      },
    });
    const listFiles = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, index) => ({ filename: `src/file-${index}.ts` })) })
      .mockResolvedValueOnce({ data: [{ filename: 'src/file-100.ts' }] });
    const client = new OctokitGitHubClient('test-token');
    (client as unknown as { octokit: { graphql: typeof graphql; rest: { pulls: { listFiles: typeof listFiles } } } }).octokit = {
      graphql,
      rest: { pulls: { listFiles } },
    };

    const first = await client.listRecentMergedPullRequests({ owner: 'acme', name: 'payments' });
    const second = await client.listRecentMergedPullRequests({ owner: 'acme', name: 'payments' });

    const [query, variables] = graphql.mock.calls[0]!;
    expect(query).toContain('pullRequests(first: $first');
    expect(query).not.toContain('files(first:');
    expect(variables).toMatchObject({ owner: 'acme', name: 'payments', first: 20 });
    expect(listFiles).toHaveBeenNthCalledWith(1, expect.objectContaining({ pull_number: 17, page: 1, per_page: 100 }));
    expect(listFiles).toHaveBeenNthCalledWith(2, expect.objectContaining({ pull_number: 17, page: 2, per_page: 100 }));
    expect(first[0]?.files).toHaveLength(101);
    expect(second).toEqual(first);
    expect(graphql).toHaveBeenCalledTimes(1);
    expect(listFiles).toHaveBeenCalledTimes(2);
  });
});
