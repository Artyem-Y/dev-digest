import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

d('Blast Radius route', () => {
  let pg: PgFixture;
  let pullId: string;
  let otherPullId: string;

  beforeAll(async () => {
    pg = await startPg();
    const { workspaceId } = await seed(pg.handle.db);
    const [otherWorkspace] = await pg.handle.db.insert(t.workspaces).values({ name: 'blast-other' }).returning();
    const [repo, otherRepo] = await pg.handle.db.insert(t.repos).values([
      { workspaceId, owner: 'acme', name: 'blast', fullName: 'acme/blast' },
      { workspaceId: otherWorkspace!.id, owner: 'other', name: 'blast', fullName: 'other/blast' },
    ]).returning();
    const [pull, otherPull] = await pg.handle.db.insert(t.pullRequests).values([
      { workspaceId, repoId: repo!.id, number: 1, title: 'Blast', author: 'octocat', branch: 'blast', base: 'main', headSha: 'a'.repeat(40) },
      { workspaceId: otherWorkspace!.id, repoId: otherRepo!.id, number: 2, title: 'Other blast', author: 'octocat', branch: 'blast', base: 'main', headSha: 'b'.repeat(40) },
    ]).returning();
    await pg.handle.db.insert(t.prFiles).values({ prId: pull!.id, path: 'src/limit.ts', additions: 2, deletions: 1, patch: null });
    pullId = pull!.id;
    otherPullId = otherPull!.id;
  });

  afterAll(async () => pg?.stop());

  it('reads persisted changed files once and returns the validated shared DTO', async () => {
    const getBlastRadius = vi.fn().mockResolvedValue({
      changedSymbols: [{ name: 'rateLimit', file: 'src/limit.ts', kind: 'function' }],
      callers: [{ viaSymbol: 'rateLimit', symbol: 'publicRouter', file: 'src/api/public.ts', line: 9, rank: 1 }],
      impactedEndpoints: ['GET /public/items'],
      factsByFile: { 'src/api/public.ts': { endpoints: ['GET /public/items'], crons: [] } },
      degraded: false,
    });
    const app = await buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: {
        repoIntel: { getBlastRadius } as never,
        github: new MockGitHubClient({
          mergedPulls: [{ number: 17, title: 'Earlier limiter work', author: 'marisa', mergedAt: '2026-10-19T10:00:00Z', files: ['src/limit.ts'] }],
        }),
      },
    });

    const response = await app.inject({ method: 'GET', url: `/pulls/${pullId}/blast` });

    expect(response.statusCode).toBe(200);
    expect(getBlastRadius).toHaveBeenCalledTimes(1);
    expect(getBlastRadius).toHaveBeenCalledWith(expect.any(String), ['src/limit.ts']);
    expect(response.json()).toMatchObject({
      changed_symbols: [{ name: 'rateLimit', file: 'src/limit.ts' }],
      changedSymbols: [{ name: 'rateLimit', file: 'src/limit.ts' }],
      callers: [{ viaSymbol: 'rateLimit', symbol: 'publicRouter', line: 9, rank: 1 }],
      downstream: [{ symbol: 'rateLimit', callers: [{ name: 'publicRouter', line: 9 }] }],
      degraded: false,
      reason: null,
      prior_prs: {
        history: [{ pr_number: 17, title: 'Earlier limiter work', author: 'marisa', files_overlap: ['src/limit.ts'] }],
      },
    });
    await app.close();
  });

  it('does not reveal a pull request outside the active workspace', async () => {
    const app = await buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: { repoIntel: { getBlastRadius: vi.fn() } as never },
    });

    const response = await app.inject({ method: 'GET', url: `/pulls/${otherPullId}/blast` });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
