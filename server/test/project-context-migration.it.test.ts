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

d('Project Context migration upgrade', () => {
  let container: StartedPostgreSqlContainer;
  let migrations: string;
  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
    migrations = await mkdtemp(join(tmpdir(), 'devdigest-migrations-'));
  });
  afterAll(async () => {
    if (container) await container.stop();
    if (migrations) await rm(migrations, { recursive: true, force: true });
  });

  it('upgrades a database with existing attachments without losing them', async () => {
    const source = join(process.cwd(), 'src/db/migrations');
    const journal = JSON.parse(await readFile(join(source, 'meta/_journal.json'), 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 14);
    await mkdir(join(migrations, 'meta'));
    await writeFile(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
    for (const entry of journal.entries) await cp(join(source, `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
    const sql = postgres(container.getConnectionUri(), { max: 1 });
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      await migrate(drizzle(sql), { migrationsFolder: migrations });
      await sql`INSERT INTO workspaces (id, name) VALUES ('10000000-0000-0000-0000-000000000001', 'upgrade')`;
      await sql`INSERT INTO repos (id, workspace_id, owner, name, full_name) VALUES ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'acme', 'repo', 'acme/repo')`;
      await sql`INSERT INTO agents (id, workspace_id, name, provider, model, system_prompt) VALUES ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'agent', 'openai', 'model', 'review')`;
      await sql`INSERT INTO skills (id, workspace_id, name, description, type, source, body) VALUES ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'skill', 'description', 'rubric', 'manual', 'body')`;
      await sql`INSERT INTO agent_project_documents (workspace_id, repo_id, agent_id, path) VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'docs/spec.md')`;
      await sql`INSERT INTO skill_project_documents (workspace_id, repo_id, skill_id, path) VALUES ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'docs/skill.md')`;
      await runMigrations(container.getConnectionUri());
      const rows = await sql`SELECT path, "order" FROM agent_project_documents`;
      expect(rows).toMatchObject([{ path: 'docs/spec.md', order: 0 }]);
      const skillRows = await sql`SELECT path, "order" FROM skill_project_documents`;
      expect(skillRows).toMatchObject([{ path: 'docs/skill.md', order: 0 }]);
    } finally { await sql.end(); }
  });
});
