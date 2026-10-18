import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[mcp-api] Docker not available — skipping integration tests.');
}

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('MCP-facing API projections', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [workspace] = await pg.handle.db
      .select({ id: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));
    workspaceId = workspace!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    return buildApp({ config: config(), db: pg.handle.db });
  }

  it('returns only safe agent summaries without prompts or output schemas', async () => {
    const [agent] = await pg.handle.db
      .insert(t.agents)
      .values({
        workspaceId,
        name: 'MCP Security Reviewer',
        description: 'Finds security issues.',
        provider: 'openai',
        model: 'gpt-4.1-mini',
        systemPrompt: 'Sensitive agent instructions must never leave the server.',
        outputSchema: { private: 'schema' },
        enabled: true,
        version: 7,
      })
      .returning();
    const app = await makeApp();

    const response = await app.inject({ method: 'GET', url: '/agents/summary' });

    expect(response.statusCode).toBe(200);
    const summaries = response.json() as Record<string, unknown>[];
    const summary = summaries.find((item) => item.id === agent!.id);
    expect(summary).toEqual({
      id: agent!.id,
      name: 'MCP Security Reviewer',
      description: 'Finds security issues.',
      enabled: true,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      version: 7,
    });
    expect(JSON.stringify(summaries)).not.toContain('Sensitive agent instructions');
    expect(JSON.stringify(summaries)).not.toContain('output_schema');
    await app.close();
  });

  it('returns persisted findings for exactly one workspace-scoped run', async () => {
    const { run } = await createCompletedRun(pg.handle.db, workspaceId);
    const app = await makeApp();

    const response = await app.inject({ method: 'GET', url: `/runs/${run.id}/findings` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      run_id: run.id,
      status: 'done',
      error: null,
      verdict: 'request_changes',
      summary: 'A persisted review summary.',
      score: 65,
      severity_counts: { critical: 1, warning: 0, suggestion: 20 },
      findings_truncated: true,
      findings: [
        {
          severity: 'CRITICAL',
          category: 'security',
          file: 'src/auth.ts',
          start_line: 12,
          end_line: 12,
        },
      ],
    });
    expect(response.json().findings).toHaveLength(20);
    expect(response.json().findings[0].severity).toBe('CRITICAL');
    await app.close();
  });

  it('returns 404 for a run outside the request workspace', async () => {
    const [otherWorkspace] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: 'mcp-other-workspace' })
      .returning();
    const { run } = await createCompletedRun(pg.handle.db, otherWorkspace!.id);
    const app = await makeApp();

    const response = await app.inject({ method: 'GET', url: `/runs/${run.id}/findings` });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

async function createCompletedRun(db: PgFixture['handle']['db'], workspaceId: string) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [repo] = await db.insert(t.repos).values({
    workspaceId,
    owner: 'acme',
    name: `mcp-api-${suffix}`,
    fullName: `acme/mcp-api-${suffix}`,
  }).returning();
  const [pull] = await db.insert(t.pullRequests).values({
    workspaceId,
    repoId: repo!.id,
    number: 3,
    title: 'MCP API test',
    author: 'octocat',
    branch: 'mcp-api',
    base: 'main',
    headSha: 'abc123',
  }).returning();
  const [run] = await db.insert(t.agentRuns).values({
    workspaceId,
    prId: pull!.id,
    status: 'done',
    score: 65,
    findingsCount: 21,
    source: 'local',
  }).returning();
  const [review] = await db.insert(t.reviews).values({
    workspaceId,
    prId: pull!.id,
    runId: run!.id,
    kind: 'review',
    verdict: 'request_changes',
    summary: 'A persisted review summary.',
    score: 65,
    model: 'gpt-4.1-mini',
  }).returning();
  await db.insert(t.findings).values(
    Array.from({ length: 21 }, (_, index) => ({
      reviewId: review!.id,
      severity: index === 20 ? 'CRITICAL' : 'SUGGESTION',
      category: 'security',
      title: index === 0 ? 'Persisted finding' : `Persisted finding ${index + 1}`,
      file: 'src/auth.ts',
      startLine: 12,
      endLine: 12,
      rationale: 'The persisted rationale.',
      confidence: 0.99,
    })),
  );
  return { run: run! };
}
