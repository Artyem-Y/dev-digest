import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';

const d = (await dockerAvailable()) ? describe : describe.skip;

d('PR Brief cache route', () => {
  let pg: PgFixture;
  let pullId: string;
  beforeAll(async () => {
    pg = await startPg();
    const { workspaceId } = await seed(pg.handle.db);
    const [repo] = await pg.handle.db.insert(t.repos).values({ workspaceId, owner: 'acme', name: 'brief', fullName: 'acme/brief' }).returning();
    const [pull] = await pg.handle.db.insert(t.pullRequests).values({ workspaceId, repoId: repo!.id, number: 1, title: 'Brief', author: 'a', branch: 'b', base: 'main', headSha: 'sha' }).returning();
    pullId = pull!.id;
    await pg.handle.db.insert(t.prBrief).values({
      prId: pullId,
      json: { summary: 'saved', head_sha: 'sha', risks: { risks: [] }, review_focus: [], intent: { intent: '', in_scope: [], out_of_scope: [] }, blast: { changed_symbols: [], downstream: [], summary: '', degraded: true, reason: 'no_data', prior_prs: null }, history: { history: [] } },
    });
  });
  afterAll(async () => pg?.stop());

  it('reloads a current persisted cache without resolving a provider', async () => {
    const app = await buildApp({ config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv), db: pg.handle.db });
    const response = await app.inject({ method: 'GET', url: `/pulls/${pullId}/brief` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ cache: { cache_state: 'current', brief: { summary: 'saved', head_sha: 'sha' } }, sources: [] });
    await app.close();
  });
});
