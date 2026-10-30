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
d('PR Brief migration upgrade', () => {
  let container: StartedPostgreSqlContainer;
  let migrations: string;
  beforeAll(async () => { container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start(); migrations = await mkdtemp(join(tmpdir(), 'devdigest-brief-upgrade-')); });
  afterAll(async () => { if (container) await container.stop(); if (migrations) await rm(migrations, { recursive: true, force: true }); });
  it('preserves the cached brief, SHA, source statuses and telemetry', async () => {
    const source = join(process.cwd(), 'src/db/migrations');
    const journal = JSON.parse(await readFile(join(source, 'meta/_journal.json'), 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 15);
    await mkdir(join(migrations, 'meta'));
    await writeFile(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
    for (const entry of journal.entries) await cp(join(source, `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
    const sql = postgres(container.getConnectionUri(), { max: 1 });
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      await migrate(drizzle(sql), { migrationsFolder: migrations });
      await sql`INSERT INTO workspaces (id, name) VALUES ('10000000-0000-0000-0000-000000000001', 'upgrade')`;
      await sql`INSERT INTO repos (id, workspace_id, owner, name, full_name) VALUES ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'acme', 'repo', 'acme/repo')`;
      await sql`INSERT INTO pull_requests (id, workspace_id, repo_id, number, title, author, branch, base, head_sha) VALUES ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 1, 'title', 'author', 'branch', 'main', 'sha')`;
      await sql`INSERT INTO pr_brief (pr_id, json, head_sha, sources, telemetry) VALUES ('10000000-0000-0000-0000-000000000003', '{"summary":"saved"}'::jsonb, 'sha', '[{"status":"available"}]'::jsonb, '{"call_count":1}'::jsonb)`;
      await runMigrations(container.getConnectionUri());
      const rows = await sql`SELECT json FROM pr_brief`;
      expect(rows[0]?.json).toEqual({ brief: { summary: 'saved', head_sha: 'sha' }, sources: [{ status: 'available' }], telemetry: { call_count: 1 }, previous_head_sha: 'sha' });
      const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'pr_brief' ORDER BY column_name`;
      expect(columns.map((row) => row.column_name)).toEqual(['json', 'pr_id']);
    } finally { await sql.end(); }
  });
});
