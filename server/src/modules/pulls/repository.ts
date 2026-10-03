import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { PrDetail, PrMeta } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { rollupSeverities, selectLatestReviewIdsPerAgent } from './status.js';
import type {
  PersistedPullCommit,
  PersistedPullFile,
  PullRepositoryRow,
  PullReviewSummary,
  PullRow,
  PullsRepositoryPort,
} from './service.js';

function toPullRow(row: typeof t.pullRequests.$inferSelect): PullRow {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    repoId: row.repoId,
    number: row.number,
    title: row.title,
    author: row.author,
    branch: row.branch,
    base: row.base,
    headSha: row.headSha,
    additions: row.additions,
    deletions: row.deletions,
    filesCount: row.filesCount,
    status: row.status,
    body: row.body,
    openedAt: row.openedAt,
    updatedAt: row.updatedAt,
    lastReviewedSha: row.lastReviewedSha,
  };
}

function toRepoRow(row: typeof t.repos.$inferSelect): PullRepositoryRow {
  return { id: row.id, owner: row.owner, name: row.name };
}

/**
 * Drizzle adapter for pulls. Tenant-scoped lookups live here so application
 * use cases cannot accidentally query a pull by ID outside its workspace.
 */
export class PullsRepository implements PullsRepositoryPort {
  constructor(private readonly db: Db) {}

  async findRepo(workspaceId: string, repoId: string): Promise<PullRepositoryRow | undefined> {
    const [repo] = await this.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return repo ? toRepoRow(repo) : undefined;
  }

  async listPulls(repoId: string): Promise<PullRow[]> {
    const rows = await this.db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
    return rows.map(toPullRow);
  }

  async upsertPull(workspaceId: string, repoId: string, pull: PrMeta): Promise<void> {
    await this.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: pull.number,
        title: pull.title,
        author: pull.author,
        branch: pull.branch,
        base: pull.base,
        headSha: pull.head_sha,
        additions: pull.additions,
        deletions: pull.deletions,
        filesCount: pull.files_count,
        status: pull.status,
        openedAt: pull.opened_at ? new Date(pull.opened_at) : null,
        updatedAt: pull.updated_at ? new Date(pull.updated_at) : null,
      })
      .onConflictDoUpdate({
        target: [t.pullRequests.repoId, t.pullRequests.number],
        set: {
          title: pull.title,
          headSha: pull.head_sha,
          status: pull.status,
          updatedAt: pull.updated_at ? new Date(pull.updated_at) : null,
        },
      });
  }

  async updateStats(
    pullId: string,
    stats: Pick<PrMeta, 'additions' | 'deletions' | 'files_count'>,
  ): Promise<void> {
    await this.db
      .update(t.pullRequests)
      .set({
        additions: stats.additions,
        deletions: stats.deletions,
        filesCount: stats.files_count,
      })
      .where(eq(t.pullRequests.id, pullId));
  }

  async latestReviewSummaries(pullIds: string[]): Promise<Map<string, PullReviewSummary>> {
    if (pullIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: t.reviews.id, prId: t.reviews.prId, agentId: t.reviews.agentId, score: t.reviews.score })
      .from(t.reviews)
      .where(and(inArray(t.reviews.prId, pullIds), eq(t.reviews.kind, 'review')))
      .orderBy(desc(t.reviews.createdAt), desc(t.reviews.id));
    const latest = new Map<string, PullReviewSummary>();
    for (const row of rows) {
      if (!latest.has(row.prId)) {
        latest.set(row.prId, {
          score: row.score,
          findingsCounts: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 },
        });
      }
    }

    const currentReviewIds = selectLatestReviewIdsPerAgent(rows);
    if (currentReviewIds.size === 0) return latest;
    const findings = await this.db
      .select({ reviewId: t.findings.reviewId, severity: t.findings.severity })
      .from(t.findings)
      .where(inArray(t.findings.reviewId, [...currentReviewIds]));
    const reviewToPr = new Map(rows.map((row) => [row.id, row.prId]));
    const findingsByReview = new Map<string, { severity: string }[]>();
    for (const finding of findings) {
      const current = findingsByReview.get(finding.reviewId) ?? [];
      current.push(finding);
      findingsByReview.set(finding.reviewId, current);
    }
    for (const reviewId of currentReviewIds) {
      const prId = reviewToPr.get(reviewId);
      if (!prId) continue;
      const summary = latest.get(prId);
      if (!summary) continue;
      const counts = rollupSeverities(findingsByReview.get(reviewId) ?? []);
      summary.findingsCounts.CRITICAL += counts.critical;
      summary.findingsCounts.WARNING += counts.warning;
      summary.findingsCounts.SUGGESTION += counts.suggestion;
    }
    return latest;
  }

  async latestCosts(workspaceId: string, pullIds: string[]): Promise<Map<string, number | null>> {
    if (pullIds.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([t.agentRuns.prId], {
        prId: t.agentRuns.prId,
        costUsd: t.agentRuns.costUsd,
      })
      .from(t.agentRuns)
      .where(
        and(
          eq(t.agentRuns.workspaceId, workspaceId),
          inArray(t.agentRuns.prId, pullIds),
          inArray(t.agentRuns.status, ['done', 'failed', 'cancelled']),
        ),
      )
      .orderBy(asc(t.agentRuns.prId), desc(t.agentRuns.ranAt), desc(t.agentRuns.id));
    const latest = new Map<string, number | null>();
    for (const row of rows) {
      if (row.prId) latest.set(row.prId, row.costUsd);
    }
    return latest;
  }

  async findPullWithRepo(workspaceId: string, pullId: string) {
    return this.findPullAndRepo(workspaceId, pullId);
  }

  async replaceSnapshot(pullId: string, detail: PrDetail): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(t.prFiles).where(eq(t.prFiles.prId, pullId));
      if (detail.files.length > 0) {
        await tx.insert(t.prFiles).values(
          detail.files.map((file) => ({
            prId: pullId,
            path: file.path,
            additions: file.additions,
            deletions: file.deletions,
            patch: file.patch ?? null,
          })),
        );
      }
      await tx.delete(t.prCommits).where(eq(t.prCommits.prId, pullId));
      if (detail.commits.length > 0) {
        await tx.insert(t.prCommits).values(
          detail.commits.map((commit) => ({
            prId: pullId,
            sha: commit.sha,
            message: commit.message,
            author: commit.author,
            committedAt: commit.committed_at ? new Date(commit.committed_at) : null,
          })),
        );
      }
      await tx
        .update(t.pullRequests)
        .set({
          body: detail.body ?? null,
          additions: detail.additions,
          deletions: detail.deletions,
          filesCount: detail.files_count,
        })
        .where(eq(t.pullRequests.id, pullId));
    });
  }

  async persistedDetail(pullId: string): Promise<{
    pull: PullRow;
    files: PersistedPullFile[];
    commits: PersistedPullCommit[];
  }> {
    const [pull] = await this.db.select().from(t.pullRequests).where(eq(t.pullRequests.id, pullId));
    if (!pull) throw new Error(`Pull request ${pullId} disappeared while loading its persisted detail`);
    const [files, commits] = await Promise.all([
      this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pullId)),
      this.db.select().from(t.prCommits).where(eq(t.prCommits.prId, pullId)),
    ]);
    return {
      pull: toPullRow(pull),
      files: files.map((file) => ({
        path: file.path,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
      })),
      commits: commits.map((commit) => ({
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        committedAt: commit.committedAt,
      })),
    };
  }

  async findPullAndRepo(workspaceId: string, pullId: string): Promise<{
    pull: PullRow;
    repo: PullRepositoryRow;
  } | undefined> {
    const [pull] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, pullId)));
    if (!pull) return undefined;
    const [repo] = await this.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, pull.repoId)));
    if (!repo) return undefined;
    return { pull: toPullRow(pull), repo: toRepoRow(repo) };
  }
}
