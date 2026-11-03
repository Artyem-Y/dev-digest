/** Isolated browser-test entry point; never used by the production server. */
import { createHash } from 'node:crypto';
import { parseUnifiedDiff } from '../src/adapters/git/diff-parser.js';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { createDb } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { createE2EOnboardingFixture } from '../src/adapters/llm/e2e-onboarding-fixture.js';

const env = process.env;
if (env.NODE_ENV !== 'test' || env.E2E_HERMETIC !== '1' || env.E2E_HERMETIC_RUNNER !== 'scripts-e2e-sh-v1' || env.DEVDIGEST_E2E_BRIEF_FIXTURE !== '1' || !env.E2E_PG_PORT || env.E2E_PG_PORT === '5432') {
  throw new Error('Project Context browser fixture requires the isolated E2E runner');
}
const config = loadConfig();
const database = new URL(config.databaseUrl);
if (database.hostname !== '127.0.0.1' || database.port !== env.E2E_PG_PORT) throw new Error('Project Context fixture requires the isolated database');

const root = await mkdtemp(join(tmpdir(), 'devdigest-context-e2e-'));
const db = createDb(config.databaseUrl);
const exec = promisify(execFile);
await mkdir(join(root, 'docs'));
if (env.DEVDIGEST_E2E_ONBOARDING_FIXTURE === '1') {
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'main.ts'), "import './lib';\n// TODO inspect the application entry\n");
  await writeFile(join(root, 'src', 'lib.ts'), 'export const ready = true;\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'echo fixture' } }));
}
await writeFile(join(root, 'docs', 'project-spec.md'), '# Browser fixture\nReviews must use the attached project specification.\n');
await exec('git', ['-C', root, 'init', '-q']);
await exec('git', ['-C', root, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
await exec('git', ['-C', root, 'add', '.']);
await exec('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
await db.db.update(schema.repos).set({ clonePath: root }).where(eq(schema.repos.fullName, 'acme/payments-api'));
if (env.DEVDIGEST_E2E_ONBOARDING_FIXTURE === '1') {
  const sha = (await exec('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
  const [repo] = await db.db.select({ id: schema.repos.id }).from(schema.repos).where(eq(schema.repos.fullName, 'acme/payments-api'));
  if (!repo) throw new Error('Seeded repository missing');
  await db.db.insert(schema.repoIndexState).values({ repoId: repo.id, lastIndexedSha: sha, indexerVersion: 1, status: 'full', filesIndexed: 2, filesSkipped: 0, stats: {} });
  await db.db.insert(schema.fileRank).values(['src/main.ts', 'src/lib.ts'].map((filePath, i) => ({ repoId: repo.id, filePath, pagerank: 2 - i, hotness: 0, rank: 2 - i, percentile: 90 - i })));
  await db.db.insert(schema.fileEdges).values({ repoId: repo.id, fromFile: 'src/main.ts', toFile: 'src/lib.ts' });
}
const evalGit = env.E2E_FLOW === '15-eval-pipeline.flow.json' ? new MockGitClient() : undefined;
const llm = new MockLLMProvider('openai', { structured: { verdict: 'approve', summary: 'Fixture review complete', score: 100, findings: [] } });
if (env.E2E_FLOW === '15-eval-pipeline.flow.json') {
  const [review] = await db.db.select().from(schema.reviews).where(and(eq(schema.reviews.summary, 'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.'), eq(schema.reviews.kind, 'review')));
  if (!review?.runId) throw new Error('Seeded review is missing');
  // Deliberately synthetic browser data, with the same provenance path as a real review.
  const raw = 'diff --git a/synthetic/divide.ts b/synthetic/divide.ts\n--- a/synthetic/divide.ts\n+++ b/synthetic/divide.ts\n@@ -0,0 +1,3 @@\n+export function divide(a: number, b: number) {\n+  return a / b;\n+}\ndiff --git a/synthetic/identity.ts b/synthetic/identity.ts\n--- a/synthetic/identity.ts\n+++ b/synthetic/identity.ts\n@@ -0,0 +1,3 @@\n+export function identity(value: string) {\n+  return value;\n+}\n';
  evalGit!.diff = async () => parseUnifiedDiff(raw);
  await db.db.insert(schema.evalReviewInputs).values({ workspaceId: review.workspaceId, runId: review.runId, input: { diffHash: createHash('sha256').update(raw).digest('hex') } });
  await db.db.update(schema.findings).set({ file: 'synthetic/divide.ts', startLine: 2, endLine: 2, title: 'Synthetic division example', rationale: 'The synthetic example divides without a zero guard.', suggestion: null }).where(and(eq(schema.findings.reviewId, review.id), eq(schema.findings.title, 'Hardcoded Stripe secret key in commit')));
  await db.db.update(schema.findings).set({ file: 'synthetic/identity.ts', startLine: 2, endLine: 2, title: 'Synthetic identity example', rationale: 'The synthetic example is an ordinary identity function.', suggestion: null }).where(and(eq(schema.findings.reviewId, review.id), eq(schema.findings.title, 'N+1 query in user list endpoint')));
}
const app = await buildApp({ config, db: db.db, overrides: { ...(evalGit ? { git: evalGit } : {}), llm: { openrouter: env.DEVDIGEST_E2E_ONBOARDING_FIXTURE === '1' ? createE2EOnboardingFixture(llm) : llm } } });
const close = async () => { await app.close(); await db.close(); await rm(root, { recursive: true, force: true }); };
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void close().finally(() => process.exit(0)); });
await app.listen({ port: config.apiPort, host: '127.0.0.1' });
