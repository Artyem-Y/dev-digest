import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';

const d = (await dockerAvailable()) ? describe : describe.skip;

d('hermetic PR Brief fixture', () => {
  let pg: PgFixture;
  let pullId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [pull] = await pg.handle.db.select().from(t.pullRequests).where(eq(t.pullRequests.number, 482));
    pullId = pull!.id;
  });
  afterAll(async () => pg?.stop());

  it('generates a stable Brief without a provider key and reloads the persisted cache', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFixture = process.env.DEVDIGEST_E2E_BRIEF_FIXTURE;
    process.env.NODE_ENV = 'test';
    process.env.DEVDIGEST_E2E_BRIEF_FIXTURE = '1';
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', DEVDIGEST_E2E_BRIEF_FIXTURE: '1', OPENAI_API_KEY: undefined } as NodeJS.ProcessEnv);
    const app = await buildApp({ config, db: pg.handle.db });
    try {
      const generated = await app.inject({ method: 'POST', url: `/pulls/${pullId}/brief` });
      expect(generated.statusCode).toBe(200);
      expect(generated.json()).toMatchObject({
        cache: { cache_state: 'current', brief: {
          summary: 'Public API rate limiting is wired through the new middleware.',
          review_focus: [{ file: 'src/config.ts', line: 12 }],
        } },
      });

      const reloaded = await app.inject({ method: 'GET', url: `/pulls/${pullId}/brief` });
      expect(reloaded.statusCode).toBe(200);
      expect(reloaded.json()).toMatchObject({
        cache: { cache_state: 'current', brief: {
          summary: 'Public API rate limiting is wired through the new middleware.',
        } },
      });
    } finally {
      await app.close();
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousFixture === undefined) delete process.env.DEVDIGEST_E2E_BRIEF_FIXTURE;
      else process.env.DEVDIGEST_E2E_BRIEF_FIXTURE = previousFixture;
    }
  });
});
