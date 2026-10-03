import { and, eq } from 'drizzle-orm';
import type { PrMeta } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export interface PollingRepoRow { id: string; owner: string; name: string; }
export interface PollingRepositoryPort {
  findRepo(workspaceId: string, repoId: string): Promise<PollingRepoRow | undefined>;
  upsertPull(workspaceId: string, repoId: string, pull: PrMeta): Promise<void>;
  markPolled(repoId: string): Promise<void>;
}

/** Drizzle adapter for the manual PR-list sync workflow. */
export class PollingRepository implements PollingRepositoryPort {
  constructor(private readonly db: Db) {}

  async findRepo(workspaceId: string, repoId: string): Promise<PollingRepoRow | undefined> {
    const [repo] = await this.db.select({ id: t.repos.id, owner: t.repos.owner, name: t.repos.name })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return repo;
  }

  async upsertPull(workspaceId: string, repoId: string, pull: PrMeta): Promise<void> {
    await this.db.insert(t.pullRequests).values({
      workspaceId, repoId, number: pull.number, title: pull.title, author: pull.author,
      branch: pull.branch, base: pull.base, headSha: pull.head_sha, additions: pull.additions,
      deletions: pull.deletions, filesCount: pull.files_count, status: pull.status,
      updatedAt: pull.updated_at ? new Date(pull.updated_at) : null,
    }).onConflictDoUpdate({
      target: [t.pullRequests.repoId, t.pullRequests.number],
      set: { title: pull.title, headSha: pull.head_sha, status: pull.status,
        updatedAt: pull.updated_at ? new Date(pull.updated_at) : null },
    });
  }

  async markPolled(repoId: string): Promise<void> {
    await this.db.update(t.repos).set({ lastPolledAt: new Date() }).where(eq(t.repos.id, repoId));
  }
}
