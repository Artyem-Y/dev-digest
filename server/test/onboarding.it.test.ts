import { PostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { dockerAvailable, startPg, type PgFixture } from './helpers/pg.js';
import { workspaces, repos, onboarding } from '../src/db/schema.js';
import { RepoIntelRepository } from '../src/modules/repo-intel/repository.js';
import { sql } from 'drizzle-orm';
import { OnboardingRepository } from '../src/modules/onboarding/infrastructure/onboarding.repository.js';
import { runMigrations } from '../src/db/migrate.js';

const hasDocker = await dockerAvailable();
describe.skipIf(!hasDocker)('onboarding persistence', () => {
  let fixture: PgFixture;
  let repository: OnboardingRepository;
  let workspace: string;
  let other: string;
  let repo: string;
  beforeAll(async () => {
    fixture = await startPg();
    repository = new OnboardingRepository(fixture.handle.db);
    [workspace, other] = (await fixture.handle.db.insert(workspaces).values([{ name: 'one' }, { name: 'two' }]).returning()).map((row) => row.id);
    repo = (await fixture.handle.db.insert(repos).values({ workspaceId: workspace!, owner: 'a', name: 'b', fullName: 'a/b' }).returning())[0]!.id;
    await fixture.handle.db.insert(onboarding).values({ repoId: repo, json: { legacy: true } });
  }, 120000);
  afterAll(async () => { await fixture?.stop(); });
  it('applies the clean migration chain repeatedly without destroying existing rows', async () => {
    await runMigrations(fixture.url);
    expect((await fixture.handle.db.select().from(onboarding).where(eq(onboarding.repoId, repo)))[0]?.json).toEqual({ legacy: true });
  });
  it('persists accepted provenance atomically and keeps it on a failed attempt', async () => {
    const sections = ['architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks']
      .map((id) => ({ id, items: [], unavailable_reason: null }));
    const tour = {
      repo_id: repo, sections, status: 'generated', source_revision: 'source-sha', index_revision: 'index-sha',
      index_state: 'ready', freshness: 'current', generated_at: '2026-10-29T12:00:00Z', limitations: [],
      counts: { indexed_files: 0, selected_files: 0, omitted_files: 0, estimated_tokens: 0 },
      usage: { call_count: 1, input_tokens: 0, output_tokens: null, cost_usd: null },
    };
    const first = await repository.admit(workspace!, repo, 10000);
    expect(first).toBeTruthy();
    expect(await repository.finish(workspace!, repo, first!.id, first!.token, 'generated', tour, null, tour.usage)).toBe(true);
    const saved = await repository.get(workspace!, repo);
    expect(saved?.tour).toMatchObject({ json: tour, sourceRevision: 'source-sha', indexRevision: 'index-sha', generatedAt: new Date(tour.generated_at) });
    expect(saved?.attempt).toMatchObject({ status: 'generated', usage: tour.usage });

    const next = await repository.admit(workspace!, repo, 10000);
    expect(next).toBeTruthy();
    expect(await repository.finish(workspace!, repo, next!.id, next!.token, 'failed', null, 'provider_failed')).toBe(true);
    const afterFailure = await repository.get(workspace!, repo);
    expect(afterFailure?.tour).toEqual(saved?.tour);
    expect(afterFailure?.attempt).toMatchObject({ id: next!.id, status: 'failed', reason: 'provider_failed' });
  });
  it('selects a lexical fallback when the ranked subset has no usable graph', async () => {
    await fixture.handle.db.execute(sql`insert into file_rank (repo_id, file_path, pagerank, hotness, rank, percentile)
      select ${repo}, 'file-' || lpad(n::text, 5, '0'), 1, 0, n, 0 from generate_series(1, 5001) n`);
    await fixture.handle.db.execute(sql`insert into file_edges (repo_id, from_file, to_file) values (${repo}, 'file-00001', 'file-05001')`);
    const snapshot = await new RepoIntelRepository(fixture.handle.db).getOnboardingSnapshot(repo);
    expect(snapshot.files).toHaveLength(5000);
    expect(snapshot.files[0]?.path).toBe('file-00001');
    expect(snapshot.indexedCount).toBe(5001);
    expect(snapshot.graphAvailable).toBe(false);
    expect(snapshot.hotnessAvailable).toBe(false);
  });
  it('serializes admission, fences expired workers, retains results and scopes all access', async () => {
    expect(await repository.get(other!, repo)).toBeNull();
    expect(await repository.admit(other!, repo, 1000)).toBeNull();
    const [a, b] = await Promise.all([repository.admit(workspace!, repo, 1000), repository.admit(workspace!, repo, 1000)]);
    const first = a ?? b;
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(first).toBeTruthy();
    expect(await repository.finish(other!, repo, first!.id, first!.token, 'failed', null, 'provider_failed')).toBe(false);
    expect(await repository.expire(workspace!, repo, new Date(Date.now() + 2000))).toBe(true);
    const second = await repository.admit(workspace!, repo, 10000);
    expect(second).toBeTruthy();
    expect(await repository.finish(workspace!, repo, first!.id, first!.token, 'generated', { bad: true }, null)).toBe(false);
    expect(await repository.finish(workspace!, repo, second!.id, second!.token, 'cancelled', null, 'cancelled')).toBe(true);
    expect((await repository.get(workspace!, repo))?.tour?.json).toMatchObject({ source_revision: 'source-sha' });
  });
});


describe.skipIf(!hasDocker)('onboarding migration upgrade', () => {
  it.each([false, true])('preserves rows when upgrading (legacy onboarding applied: %s)', async (legacyApplied) => {
    const container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
    const url = container.getConnectionUri();
    const client = postgres(url, { max: 1 });
    const migrations = await mkdtemp(join(tmpdir(), 'devdigest-onboarding-upgrade-'));
    try {
      await client`CREATE EXTENSION IF NOT EXISTS vector`;
      const source = fileURLToPath(new URL('../src/db/migrations', import.meta.url));
      const journal = JSON.parse(await readFile(join(source, 'meta/_journal.json'), 'utf8'));
      journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 16);
      await mkdir(join(migrations, 'meta'));
      await writeFile(join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
      for (const entry of journal.entries) await cp(join(source, `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
      await migrate(drizzle(client), { migrationsFolder: migrations });
      if (legacyApplied) {
        const legacy = await readFile(fileURLToPath(new URL('./fixtures/migrations/legacy-onboarding.sql', import.meta.url)), 'utf8');
        for (const statement of legacy.split('--> statement-breakpoint')) await client.unsafe(statement);
      }
      const [ws] = await client`INSERT INTO workspaces (name) VALUES ('legacy') RETURNING id`;
      const [repo] = await client`INSERT INTO repos (workspace_id, owner, name, full_name) VALUES (${ws!.id}, 'a', 'legacy', 'a/legacy') RETURNING id`;
      await client`INSERT INTO onboarding (repo_id, json) VALUES (${repo!.id}, ${JSON.stringify({ legacy: true })}::jsonb)`;
      await runMigrations(url);
      await runMigrations(url);
      const rows = await client`SELECT json, source_revision, index_revision FROM onboarding WHERE repo_id = ${repo!.id}`;
      expect(rows[0]).toMatchObject({ json: { legacy: true }, source_revision: null, index_revision: null });
      const applied = await client`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
      expect(applied[0]?.count).toBe(17);
    } finally {
      await client.end();
      await container.stop();
      await rm(migrations, { recursive: true, force: true });
    }
  }, 120000);
});
