import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import { buildApp } from '../src/app.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { loadConfig } from '../src/platform/config.js';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('polling route tenancy (Testcontainers pg)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => { await pg?.stop(); });

  it('returns not found instead of polling a repository from another workspace', async () => {
    const [otherWorkspace] = await pg.handle.db.insert(t.workspaces).values({ name: 'polling-other' }).returning();
    const [foreignRepo] = await pg.handle.db.insert(t.repos).values({
      workspaceId: otherWorkspace!.id,
      owner: 'other', name: 'private', fullName: 'other/private',
    }).returning();
    const app = await buildApp({
      config: config(), db: pg.handle.db, overrides: { github: new MockGitHubClient() },
    });

    const response = await app.inject({ method: 'POST', url: `/repos/${foreignRepo!.id}/poll` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
    await app.close();
  });
});
