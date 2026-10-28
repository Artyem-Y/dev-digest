import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
import { MockAuthProvider, MockLLMProvider } from '../src/adapters/mocks.js';
import { waitForPrRuns } from './helpers/runs.js';

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
    await writeFile(join(checkout, 'docs', 'skill.md'), '# Skill context');
    await execFileAsync('git', ['-C', checkout, 'init']);
    await execFileAsync('git', ['-C', checkout, 'add', 'docs/brief.md', 'docs/skill.md']);
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
    await expect(repository.listForAgent('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000111'))
      .resolves.toEqual(expect.arrayContaining([
        { path: 'docs/one.md', provenance: 'direct_agent' },
        { path: 'docs/skill.md', provenance: 'linked_skill', skillId: '10000000-0000-0000-0000-000000000333' },
      ]));
    const agentAttachments = await repository.listForAgent('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000111');
    expect(agentAttachments.map((item) => item.path)).not.toContain('docs/disabled-skill.md');
    expect(agentAttachments.map((item) => item.path)).not.toContain('docs/disabled-agent.md');
    await repository.reorder({ workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', owner: 'agent', ownerId: '10000000-0000-0000-0000-000000000111', paths: ['docs/one.md', 'docs/moved.md'] });
    await expect(repository.listOwnerAttachments({ workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', owner: 'agent', ownerId: '10000000-0000-0000-0000-000000000111' })).resolves.toEqual(['docs/one.md', 'docs/moved.md']);
    await expect(repository.reorder({ workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', owner: 'agent', ownerId: '10000000-0000-0000-0000-000000000111', paths: ['docs/one.md'] })).rejects.toThrow();
    await expect(repository.listForBrief('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011'))
      .resolves.toEqual(expect.arrayContaining([
        { path: 'docs/one.md', provenance: 'direct_agent' },
        { path: 'docs/moved.md', provenance: 'direct_agent' },
        { path: 'docs/skill.md', provenance: 'linked_skill', skillId: '10000000-0000-0000-0000-000000000333' },
      ]));

    const llm = new MockLLMProvider('openai', { structured: { verdict: 'approve', summary: 'Reviewed', score: 100, findings: [] } });
    const app = await buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: { auth: new MockAuthProvider(undefined, { id: '10000000-0000-0000-0000-000000000001', name: 'one' }), llm: { openai: llm } },
    });
    const endpoint = '/repos/10000000-0000-0000-0000-000000000011/project-context/agent/10000000-0000-0000-0000-000000000111/attachments';
    const preview = await app.inject({ method: 'GET', url: '/repos/10000000-0000-0000-0000-000000000011/project-context/documents/docs%2Fbrief.md' });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ path: 'docs/brief.md', content: '# Brief' });
    await expect(app.inject({ method: 'GET', url: endpoint }).then((response) => response.json()))
      .resolves.toEqual(expect.arrayContaining([expect.objectContaining({ path: 'docs/moved.md', status: 'no_longer_eligible' })]));
    expect((await app.inject({ method: 'DELETE', url: endpoint, payload: { path: 'docs/moved.md' } })).statusCode).toBe(204);
    await expect(app.inject({ method: 'GET', url: endpoint }).then((response) => response.json()))
      .resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ path: 'docs/moved.md' })]));

    expect((await app.inject({ method: 'POST', url: endpoint, payload: { path: 'docs/brief.md' } })).statusCode).toBe(204);
    const [pull] = await pg.handle.db.insert(t.pullRequests).values({ workspaceId: '10000000-0000-0000-0000-000000000001', repoId: '10000000-0000-0000-0000-000000000011', number: 42, title: 'Review context', author: 'author', branch: 'branch', base: 'main', headSha: 'abc', status: 'needs_review' }).returning();
    const started = await app.inject({ method: 'POST', url: `/pulls/${pull!.id}/review`, payload: { agentId: '10000000-0000-0000-0000-000000000111' } });
    expect(started.statusCode).toBe(200);
    const runs = await waitForPrRuns(pg.handle.db, pull!.id, { expected: 1 });
    expect(runs[0]?.status).toBe('done');
    const runId = runs[0]!.id;
    await vi.waitFor(async () => expect((await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).statusCode).toBe(200));
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.specs_read, JSON.stringify(trace.log)).toEqual(['docs/brief.md', 'docs/skill.md']);
    expect(trace.prompt_assembly.specs).toContain('# Brief');
    expect(trace.prompt_assembly.specs).toContain('# Skill context');
    expect(trace.prompt_assembly.specs).toContain('<untrusted source="spec-0">');
    await writeFile(join(checkout, 'docs', 'brief.md'), '# Updated after run');
    const historical = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(historical.prompt_assembly.specs).toContain('# Brief');
    expect(historical.prompt_assembly.specs).not.toContain('# Updated after run');
    await app.close();
  });
});
