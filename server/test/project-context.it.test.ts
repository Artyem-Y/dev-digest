import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';
import * as t from '../src/db/schema.js';
import { DrizzleProjectContextRepository } from '../src/modules/project-context/infrastructure/project-context.repository.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { MockAuthProvider } from '../src/adapters/mocks.js';
import projectContextRoutes from '../src/modules/project-context/routes.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const execFileAsync = promisify(execFile);

d('Project Context persistence', () => {
  let pg: PgFixture;
  let checkout: string;
  beforeAll(async () => { pg = await startPg(); });
  afterAll(async () => { await pg?.stop(); if (checkout) await rm(checkout, { recursive: true, force: true }); });

  it('migrates attachment tables and never resolves another workspace attachment', async () => {
    await pg.handle.db.insert(t.workspaces).values([
      { id: '10000000-0000-0000-0000-000000000001', name: 'one' },
      { id: '20000000-0000-0000-0000-000000000002', name: 'two' },
    ]);
    checkout = await mkdtemp(join(tmpdir(), 'devdigest-project-context-route-'));
    await mkdir(join(checkout, 'docs'));
    await writeFile(join(checkout, 'docs', 'brief.md'), '# Brief');
    await execFileAsync('git', ['-C', checkout, 'init']);
    await execFileAsync('git', ['-C', checkout, 'add', 'docs/brief.md']);
    await pg.handle.db.insert(t.repos).values([
      { id: '10000000-0000-0000-0000-000000000011', workspaceId: '10000000-0000-0000-0000-000000000001', owner: 'one', name: 'repo', fullName: 'one/repo', clonePath: checkout },
      { id: '20000000-0000-0000-0000-000000000022', workspaceId: '20000000-0000-0000-0000-000000000002', owner: 'two', name: 'repo', fullName: 'two/repo' },
    ]);
    await pg.handle.db.insert(t.agents).values([
      { id: '10000000-0000-0000-0000-000000000111', workspaceId: '10000000-0000-0000-0000-000000000001', name: 'one', provider: 'openai', model: 'model', systemPrompt: 'review' },
      { id: '20000000-0000-0000-0000-000000000222', workspaceId: '20000000-0000-0000-0000-000000000002', name: 'two', provider: 'openai', model: 'model', systemPrompt: 'review' },
      { id: '10000000-0000-0000-0000-000000000112', workspaceId: '10000000-0000-0000-0000-000000000001', name: 'disabled', provider: 'openai', model: 'model', systemPrompt: 'review', enabled: false },
    ]);
    await pg.handle.db.insert(t.skills).values([
      { id: '10000000-0000-0000-0000-000000000333', workspaceId: '10000000-0000-0000-0000-000000000001', name: 'enabled', description: 'd', type: 'rubric', source: 'manual', body: 'b' },
      { id: '10000000-0000-0000-0000-000000000334', workspaceId: '10000000-0000-0000-0000-000000000001', name: 'disabled', description: 'd', type: 'rubric', source: 'manual', body: 'b', enabled: false },
    ]);
    await pg.handle.db.insert(t.agentSkills).values([
      { agentId: '10000000-0000-0000-0000-000000000111', skillId: '10000000-0000-0000-0000-000000000333', order: 0, enabled: true },
      { agentId: '10000000-0000-0000-0000-000000000111', skillId: '10000000-0000-0000-0000-000000000334', order: 1, enabled: true },
    ]);
    await pg.handle.db.insert(t.agentProjectDocuments).values([
      { workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', agentId: '10000000-0000-0000-0000-000000000111', path: 'docs/one.md' },
      { workspaceId: '20000000-0000-0000-0000-000000000002', repoId: '20000000-0000-0000-0000-000000000022', agentId: '20000000-0000-0000-0000-000000000222', path: 'docs/two.md' },
      { workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', agentId: '10000000-0000-0000-0000-000000000112', path: 'docs/disabled-agent.md' },
      { workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', agentId: '10000000-0000-0000-0000-000000000111', path: 'docs/moved.md' },
    ]);
    await pg.handle.db.insert(t.skillProjectDocuments).values([
      { workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', skillId: '10000000-0000-0000-0000-000000000333', path: 'docs/skill.md' },
      { workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', skillId: '10000000-0000-0000-0000-000000000334', path: 'docs/disabled-skill.md' },
    ]);
    const repository = new DrizzleProjectContextRepository(pg.handle.db);
    await expect(repository.listForBrief('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011'))
      .resolves.toEqual([
        { path: 'docs/one.md', provenance: 'direct_agent' },
        { path: 'docs/moved.md', provenance: 'direct_agent' },
        { path: 'docs/skill.md', provenance: 'linked_skill', skillId: '10000000-0000-0000-0000-000000000333' },
      ]);

    const app = await buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: { auth: new MockAuthProvider(undefined, { id: '10000000-0000-0000-0000-000000000001', name: 'one' }) },
    });
    await app.register(projectContextRoutes);
    const endpoint = '/repos/10000000-0000-0000-0000-000000000011/project-context/agent/10000000-0000-0000-0000-000000000111/attachments';
    await expect(app.inject({ method: 'GET', url: endpoint }).then((response) => response.json()))
      .resolves.toEqual(expect.arrayContaining([expect.objectContaining({ path: 'docs/moved.md', status: 'no_longer_eligible' })]));
    expect((await app.inject({ method: 'DELETE', url: endpoint, payload: { path: 'docs/moved.md' } })).statusCode).toBe(204);
    await expect(app.inject({ method: 'GET', url: endpoint }).then((response) => response.json()))
      .resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ path: 'docs/moved.md' })]));
    await app.close();
  });
});
