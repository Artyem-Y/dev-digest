import type { GitHubClient, PrDetail, PrMeta, PrReviewComment } from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { deriveReviewStatus } from './status.js';

export interface PullRepositoryRow {
  id: string;
  owner: string;
  name: string;
}

export interface PullRow {
  id: string;
  workspaceId: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  additions: number;
  deletions: number;
  filesCount: number;
  status: string;
  body: string | null;
  openedAt: Date | null;
  updatedAt: Date | null;
  lastReviewedSha: string | null;
}

export interface PersistedPullFile {
  path: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface PersistedPullCommit {
  sha: string;
  message: string;
  author: string;
  committedAt: Date | null;
}

export interface PullsRepositoryPort {
  findRepo(workspaceId: string, repoId: string): Promise<PullRepositoryRow | undefined>;
  listPulls(repoId: string): Promise<PullRow[]>;
  upsertPull(workspaceId: string, repoId: string, pull: PrMeta): Promise<void>;
  updateStats(pullId: string, stats: Pick<PrMeta, 'additions' | 'deletions' | 'files_count'>): Promise<void>;
  latestReviewScores(pullIds: string[]): Promise<Map<string, number | null>>;
  latestCosts(workspaceId: string, pullIds: string[]): Promise<Map<string, number | null>>;
  findPullWithRepo(
    workspaceId: string,
    pullId: string,
  ): Promise<{ pull: PullRow; repo: PullRepositoryRow } | undefined>;
  replaceSnapshot(pullId: string, detail: PrDetail): Promise<void>;
  persistedDetail(
    pullId: string,
  ): Promise<{ pull: PullRow; files: PersistedPullFile[]; commits: PersistedPullCommit[] }>;
  findPullAndRepo(
    workspaceId: string,
    pullId: string,
  ): Promise<{ pull: PullRow; repo: PullRepositoryRow } | undefined>;
}

export interface PullCommentInput {
  path: string;
  line: number;
  side?: 'LEFT' | 'RIGHT';
  body: string;
  in_reply_to?: number;
}

export type GitHubResolver = () => Promise<GitHubClient>;

export type PullsWarningLogger = (error: unknown, message: string, meta?: Record<string, unknown>) => void;

const NOOP_WARNING_LOGGER: PullsWarningLogger = () => {};
const BACKFILL_LIMIT = 10;

/**
 * Application use cases for pull requests. This layer is transport- and
 * persistence-agnostic: Fastify/Zod stay in routes and Drizzle stays behind
 * PullsRepositoryPort.
 */
export class PullsService {
  constructor(
    private readonly repository: PullsRepositoryPort,
    private readonly resolveGitHub: GitHubResolver,
    private readonly now: () => number = Date.now,
    private readonly warn: PullsWarningLogger = NOOP_WARNING_LOGGER,
  ) {}

  async list(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const repo = await this.repository.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    let github: GitHubClient | null = null;
    try {
      github = await this.resolveGitHub();
    } catch (error) {
      this.warn(error, 'GitHub client unavailable (no token / offline); serving persisted PRs');
    }

    if (github) {
      try {
        const pulls = await github.listPullRequests({ owner: repo.owner, name: repo.name });
        for (const pull of pulls) {
          await this.repository.upsertPull(workspaceId, repo.id, pull);
        }
      } catch (error) {
        this.warn(error, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const rows = await this.repository.listPulls(repo.id);
    if (github) await this.backfillStats(github, repo, rows);

    const pullIds = rows.map((row) => row.id);
    const [reviewScores, costs] = await Promise.all([
      this.repository.latestReviewScores(pullIds),
      this.repository.latestCosts(workspaceId, pullIds),
    ]);

    const now = this.now();
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      author: row.author,
      branch: row.branch,
      base: row.base,
      head_sha: row.headSha,
      additions: row.additions,
      deletions: row.deletions,
      files_count: row.filesCount,
      status: deriveReviewStatus({
        ghStatus: row.status,
        lastReviewedSha: row.lastReviewedSha,
        headSha: row.headSha,
        updatedAt: row.updatedAt,
        now,
      }),
      opened_at: row.openedAt?.toISOString() ?? null,
      updated_at: row.updatedAt?.toISOString() ?? null,
      score: reviewScores.get(row.id) ?? null,
      cost_usd: costs.get(row.id) ?? null,
    }));
  }

  async detail(workspaceId: string, pullId: string): Promise<PrDetail> {
    const resolved = await this.repository.findPullWithRepo(workspaceId, pullId);
    if (!resolved) throw new NotFoundError('Pull request not found');
    const { pull, repo } = resolved;

    try {
      const github = await this.resolveGitHub();
      const detail = await github.getPullRequest({ owner: repo.owner, name: repo.name }, pull.number);
      await this.repository.replaceSnapshot(pull.id, detail);
      return { ...detail, id: pull.id };
    } catch (error) {
      this.warn(error, 'GitHub PR detail refresh skipped (no token / offline); serving persisted detail');
      const persisted = await this.repository.persistedDetail(pull.id);
      return {
        id: persisted.pull.id,
        number: persisted.pull.number,
        title: persisted.pull.title,
        author: persisted.pull.author,
        branch: persisted.pull.branch,
        base: persisted.pull.base,
        head_sha: persisted.pull.headSha,
        additions: persisted.pull.additions,
        deletions: persisted.pull.deletions,
        files_count: persisted.pull.filesCount,
        status: persisted.pull.status as PrDetail['status'],
        opened_at: persisted.pull.openedAt?.toISOString() ?? null,
        updated_at: persisted.pull.updatedAt?.toISOString() ?? null,
        body: persisted.pull.body,
        files: persisted.files.map((file) => ({
          path: file.path,
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch,
        })),
        commits: persisted.commits.map((commit) => ({
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          committed_at: commit.committedAt?.toISOString() ?? null,
        })),
      };
    }
  }

  async listComments(workspaceId: string, pullId: string): Promise<PrReviewComment[]> {
    const { pull, repo } = await this.resolvePullAndRepo(workspaceId, pullId);
    let github: GitHubClient;
    try {
      github = await this.resolveGitHub();
    } catch (error) {
      this.warn(error, 'GitHub client unavailable; serving no PR comments');
      return [];
    }
    try {
      return await github.listReviewComments({ owner: repo.owner, name: repo.name }, pull.number);
    } catch (error) {
      this.warn(error, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  async createComment(
    workspaceId: string,
    pullId: string,
    input: PullCommentInput,
  ): Promise<PrReviewComment> {
    const { pull, repo } = await this.resolvePullAndRepo(workspaceId, pullId);
    let github: GitHubClient;
    try {
      github = await this.resolveGitHub();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await github.createReviewComment({ owner: repo.owner, name: repo.name }, pull.number, {
        commitId: pull.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', message, 400, { cause: String(error) });
    }
  }

  private async backfillStats(
    github: GitHubClient,
    repo: PullRepositoryRow,
    rows: PullRow[],
  ): Promise<void> {
    const missingStats = rows
      .filter((row) => row.additions === 0 && row.deletions === 0 && row.filesCount === 0)
      .slice(0, BACKFILL_LIMIT);
    for (const row of missingStats) {
      try {
        const detail = await github.getPullRequest({ owner: repo.owner, name: repo.name }, row.number);
        await this.repository.updateStats(row.id, detail);
        row.additions = detail.additions;
        row.deletions = detail.deletions;
        row.filesCount = detail.files_count;
      } catch (error) {
        this.warn(error, 'PR diff-stat backfill skipped', { number: row.number });
      }
    }
  }

  private async resolvePullAndRepo(workspaceId: string, pullId: string) {
    const resolved = await this.repository.findPullAndRepo(workspaceId, pullId);
    if (!resolved) throw new NotFoundError('Pull request not found');
    return resolved;
  }
}
