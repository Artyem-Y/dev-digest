import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';
import { seed } from '../src/db/seed.js';
import { loadConfig } from '../src/platform/config.js';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

d('skills API', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => pg?.stop());

  async function makeApp() {
    return buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  it('creates a manual skill at version one and lists it', async () => {
    const app = await makeApp();
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'Behavioral Test Coverage',
        description: 'Checks changed behaviour is tested.',
        type: 'rubric',
        body: 'Check positive and negative paths.',
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      name: 'Behavioral Test Coverage',
      source: 'manual',
      version: 1,
      enabled: true,
    });
    const listed = await app.inject({ method: 'GET', url: '/skills' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.json().id })]));
    await app.close();
  });

  it('versions a changed body and rejects a stale editor update', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: { name: 'Versioned', description: 'd', type: 'rubric', body: 'v1' } });
    const id = created.json().id as string;
    const updated = await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { name: 'Versioned', description: 'd', type: 'rubric', body: 'v2', enabled: true, expected_version: 1 } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().version).toBe(2);
    const stale = await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { name: 'Versioned', description: 'd', type: 'rubric', body: 'v3', enabled: true, expected_version: 1 } });
    expect(stale.statusCode).toBe(409);
    await app.close();
  });

  it('deletes an unlinked skill', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: { name: 'Disposable', description: 'd', type: 'custom', body: 'b' } });
    const deleted = await app.inject({ method: 'DELETE', url: `/skills/${created.json().id}` });
    expect(deleted.statusCode).toBe(200);
    expect(await app.inject({ method: 'GET', url: `/skills/${created.json().id}` })).toMatchObject({ statusCode: 404 });
    await app.close();
  });

  it('does not return a skill removed directly from Postgres', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: { name: 'Externally deleted', description: 'd', type: 'custom', body: 'b' } });
    const id = created.json().id as string;
    await pg.handle.db.delete(t.skills).where(eq(t.skills.id, id));

    const listed = await app.inject({ method: 'GET', url: '/skills' });
    expect(listed.json()).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    await app.close();
  });

  it('rejects duplicate links and snapshots a changed agent skill set', async () => {
    const app = await makeApp();
    const agent = await app.inject({ method: 'POST', url: '/agents', payload: { name: 'Skill consumer', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' } });
    const skill = await app.inject({ method: 'POST', url: '/skills', payload: { name: 'Reusable', description: 'd', type: 'rubric', body: 'b' } });
    const linked = await app.inject({ method: 'POST', url: `/agents/${agent.json().id}/skills`, payload: { skill_ids: [skill.json().id] } });
    expect(linked.statusCode).toBe(200);
    const versions = await app.inject({ method: 'GET', url: `/agents/${agent.json().id}/versions` });
    expect(versions.json().map((version: { version: number }) => version.version)).toEqual([2, 1]);
    const duplicate = await app.inject({ method: 'POST', url: `/agents/${agent.json().id}/skills`, payload: { skill_ids: [skill.json().id, skill.json().id] } });
    expect(duplicate.statusCode).toBe(422);
    await app.close();
  });
});
