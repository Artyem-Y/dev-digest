import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Review } from '@devdigest/shared';
import { buildApp } from '../src/app.js';
import { MockEmbedder, MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { seed } from '../src/db/seed.js';
import { loadConfig } from '../src/platform/config.js';
import * as t from '../src/db/schema.js';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

type Scenario = {
  marker: string;
  diff: string;
  path: string;
  patch: string;
  title: string;
  skill: { name: string; body: string };
  finding: Review['findings'][number];
};

const apiContract: Scenario = {
  marker: 'BREAKING-CHANGE SKILL',
  title: 'Rename a public response field',
  path: 'src/api/users.ts',
  patch: '@@ -20,3 +20,3 @@\n-export async function getUser(id: string): Promise<{ name: string }> {\n+export async function getUser(id: string): Promise<{ fullName: string }> {\n   return db.users.find(id);',
  diff: `diff --git a/src/api/users.ts b/src/api/users.ts
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -20,3 +20,3 @@
-export async function getUser(id: string): Promise<{ name: string }> {
+export async function getUser(id: string): Promise<{ fullName: string }> {
   return db.users.find(id);`,
  skill: { name: 'breaking-change experiment', body: 'BREAKING-CHANGE SKILL: flag renamed public response fields and require a compatibility path.' },
  finding: { id: 'contract-change', severity: 'WARNING', category: 'contract', title: 'Breaking response-field rename', file: 'src/api/users.ts', start_line: 21, end_line: 21, rationale: 'The public `name` field was replaced by `fullName`.', suggestion: 'Keep `name` through a deprecation period or release a major version.', confidence: 0.96, kind: 'finding' },
};

const testQuality: Scenario = {
  marker: 'TEST-QUALITY SKILL',
  title: 'Add only a happy-path test',
  path: 'src/api/users.test.ts',
  patch: "@@ -5,3 +5,5 @@\n describe('getUser', () => {\n+  it('returns an existing user', async () => {\n+    expect((await getUser('existing')).name).toBe('Ada');\n+  });\n });",
  diff: `diff --git a/src/api/users.test.ts b/src/api/users.test.ts
--- a/src/api/users.test.ts
+++ b/src/api/users.test.ts
@@ -5,3 +5,5 @@
 describe('getUser', () => {
+  it('returns an existing user', async () => {
+    expect((await getUser('existing')).name).toBe('Ada');
+  });
 });`,
  skill: { name: 'test-quality experiment', body: 'TEST-QUALITY SKILL: flag happy-path-only tests; require failure paths and boundary cases.' },
  finding: { id: 'missing-edge-case', severity: 'WARNING', category: 'test', title: 'Missing failure-path and boundary test', file: 'src/api/users.test.ts', start_line: 8, end_line: 8, rationale: 'The change adds only a success assertion.', suggestion: 'Add not-found and invalid-id cases.', confidence: 0.93, kind: 'finding' },
};

d('skill-enabled review experiments (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let sequence = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [workspace] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = workspace!.id;
  });
  afterAll(async () => pg?.stop());

  async function runComparison(scenario: Scenario) {
    const llm = new MockLLMProvider('openai', {
      structuredResolver: (request) => request.messages.some((message) => message.content.includes(scenario.marker))
        ? { verdict: 'request_changes', summary: scenario.finding.title, score: 35, findings: [scenario.finding] }
        : { verdict: 'approve', summary: 'No matching rule.', score: 100, findings: [] },
    });
    const app = await buildApp({ config: config(), db: pg.handle.db, overrides: { embedder: new MockEmbedder(), git: new MockGitClient({ diff: scenario.diff }), llm: { openai: llm, openrouter: llm } } });
    const suffix = sequence++;
    const [repo] = await pg.handle.db.insert(t.repos).values({ workspaceId, owner: 'acme', name: `skills-experiment-${suffix}`, fullName: `acme/skills-experiment-${suffix}` }).returning();
    const [pull] = await pg.handle.db.insert(t.pullRequests).values({ workspaceId, repoId: repo!.id, number: 700 + suffix, title: scenario.title, author: 'dev', branch: 'skills-experiment', base: 'main', headSha: `abc${suffix}`, additions: 3, deletions: 1, filesCount: 1, status: 'needs_review' }).returning();
    await pg.handle.db.insert(t.prFiles).values({ prId: pull!.id, path: scenario.path, additions: 3, deletions: 1, patch: scenario.patch });
    const agent = (await app.inject({ method: 'POST', url: '/agents', payload: { name: `${scenario.title} reviewer ${suffix}`, description: 'Controlled skills experiment', provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review only according to linked skills.' } })).json();

    const baseline = (await app.inject({ method: 'POST', url: `/pulls/${pull!.id}/review`, payload: { agentId: agent.id } })).json();
    await waitForPrRuns(pg.handle.db, pull!.id, { expected: 1 });
    expect((await app.inject({ method: 'GET', url: `/pulls/${pull!.id}/reviews` })).json()[0].findings).toHaveLength(0);

    const skill = (await app.inject({ method: 'POST', url: '/skills', payload: { name: scenario.skill.name, description: 'Controlled comparison fixture', type: 'rubric', body: scenario.skill.body } })).json();
    expect((await app.inject({ method: 'POST', url: `/agents/${agent.id}/skills`, payload: { skill_id: skill.id } })).statusCode).toBe(200);
    const enabled = (await app.inject({ method: 'POST', url: `/pulls/${pull!.id}/review`, payload: { agentId: agent.id } })).json();
    await waitForPrRuns(pg.handle.db, pull!.id, { expected: 2 });

    const reviews = (await app.inject({ method: 'GET', url: `/pulls/${pull!.id}/reviews` })).json();
    expect(reviews[0].findings).toHaveLength(1);
    expect(reviews[0].findings[0]).toMatchObject({ title: scenario.finding.title, file: scenario.path });
    const trace = (await app.inject({ method: 'GET', url: `/runs/${enabled.runs[0].run_id}/trace` })).json();
    expect(trace.prompt_assembly.skills).toContain(scenario.marker);
    expect(trace.prompt_assembly.skill_tokens).toBeGreaterThan(0);
    expect(baseline.runs[0].run_id).not.toBe(enabled.runs[0].run_id);
    await app.close();
  }

  it('API Contract Reviewer skips a renamed response field without a skill and flags it with one', async () => {
    await runComparison(apiContract);
  });

  it('Test Quality Reviewer skips a happy-path-only test without a skill and flags missing cases with one', async () => {
    await runComparison(testQuality);
  });
});
