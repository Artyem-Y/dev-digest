import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { SmartDiffResponse } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('Smart Diff endpoint', () => {
  let pg: PgFixture;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let prId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [pr] = await pg.handle.db.select().from(t.pullRequests).where(eq(t.pullRequests.number, 482));
    prId = pr!.id;
    app = await buildApp({ config: config(), db: pg.handle.db, overrides: {} });
  });

  afterAll(async () => { await app?.close(); await pg?.stop(); });

  it('returns a contract-valid complete grouping from stored data', async () => {
    const response = await app.inject({ method: 'GET', url: `/pulls/${prId}/smart-diff` });
    expect(response.statusCode).toBe(200);
    const body = SmartDiffResponse.parse(response.json());
    expect(body.groups.map((group) => group.role)).toEqual(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
    expect(body.split_suggestion.total_lines).toBeGreaterThan(0);
  });

  it('returns 404 for a pull that is absent from the workspace', async () => {
    const response = await app.inject({ method: 'GET', url: '/pulls/00000000-0000-0000-0000-000000000000/smart-diff' });
    expect(response.statusCode).toBe(404);
  });
});
