/** Isolated browser-test entry point; never used by the production server. */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { createDb } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { MockLLMProvider } from '../src/adapters/mocks.js';
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
const llm = new MockLLMProvider('openai', { structured: { verdict: 'approve', summary: 'Fixture review complete', score: 100, findings: [] } });
const app = await buildApp({ config, db: db.db, overrides: { llm: { openrouter: env.DEVDIGEST_E2E_ONBOARDING_FIXTURE === '1' ? createE2EOnboardingFixture(llm) : llm } } });
const close = async () => { await app.close(); await db.close(); await rm(root, { recursive: true, force: true }); };
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void close().finally(() => process.exit(0)); });
await app.listen({ port: config.apiPort, host: '127.0.0.1' });
