import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dockerAvailable } from './helpers/pg.js';
import { runMigrations } from '../src/db/migrate.js';

const d = await dockerAvailable() ? describe : describe.skip;
d('eval migration upgrade', () => {
  let container: StartedPostgreSqlContainer;
  let migrations: string;
  beforeAll(async () => { container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start(); migrations = await mkdtemp(join(tmpdir(), 'devdigest-eval-upgrade-')); }, 120_000);
  afterAll(async () => { if (container) await container.stop(); if (migrations) await rm(migrations, { recursive: true, force: true }); });
  it('preserves legacy cases and creates the new tables', async () => {
    const source = join(process.cwd(), 'src/db/migrations');
    const journal = JSON.parse(await readFile(join(source, 'meta/_journal.json'), 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 17);
    await mkdir(join(migrations, 'meta'));
    await writeFile(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
    for (const entry of journal.entries) await cp(join(source, `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
    const client = postgres(container.getConnectionUri(), { max: 1 });
    try {
      await client`CREATE EXTENSION IF NOT EXISTS vector`;
      await migrate(drizzle(client), { migrationsFolder: migrations });
      await client`INSERT INTO workspaces (id, name) VALUES ('10000000-0000-0000-0000-000000000001', 'upgrade')`;
      await client`INSERT INTO eval_cases (workspace_id, owner_kind, owner_id, name) VALUES ('10000000-0000-0000-0000-000000000001', 'agent', '10000000-0000-0000-0000-000000000002', 'legacy')`;
      await runMigrations(container.getConnectionUri());
      expect(await client`SELECT name FROM eval_cases`).toMatchObject([{ name: 'legacy' }]);
      expect(await client`SELECT count(*)::int AS count FROM eval_suite_runs`).toMatchObject([{ count: 0 }]);
    } finally { await client.end(); }
  });
});
