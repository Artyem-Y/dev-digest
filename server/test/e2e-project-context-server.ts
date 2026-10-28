/** Isolated browser-test entry point; never used by the production server. */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { createDb } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { MockLLMProvider } from '../src/adapters/mocks.js';

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
await writeFile(join(root, 'project-spec.md'), '# Browser fixture\nReviews must use the attached project specification.\n');
await exec('git', ['-C', root, 'init', '-q']);
await exec('git', ['-C', root, 'add', 'project-spec.md']);
await db.db.update(schema.repos).set({ clonePath: root }).where(eq(schema.repos.fullName, 'acme/payments-api'));
const llm = new MockLLMProvider('openai', { structured: { verdict: 'approve', summary: 'Fixture review complete', score: 100, findings: [] } });
const app = await buildApp({ config, db: db.db, overrides: { llm: { openrouter: llm } } });
const close = async () => { await app.close(); await db.close(); await rm(root, { recursive: true, force: true }); };
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void close().finally(() => process.exit(0)); });
await app.listen({ port: config.apiPort, host: '127.0.0.1' });
