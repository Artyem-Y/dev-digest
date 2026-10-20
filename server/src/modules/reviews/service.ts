import type { DerivedIntent, FindingActionKind, RunEventKind, RunTrace, RunTraceResponse } from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { AgentRow } from '../../db/rows.js';
import type { AgentsRepository } from '../agents/repository.js';
import type { RunBus } from '../../platform/sse.js';
import { ReviewRepository } from './repository.js';
import { type ReviewDto, type ReviewDtoFinding } from './helpers.js';
import { ReviewRunExecutor, type Logger } from './run-executor.js';
import { actOnFinding as actOnFindingImpl } from './findings.js';
import { reviewToDto } from './helpers.js';
import { toMcpRunResult, type McpRunResult } from './application/mcp-run-findings.js';
import type { IntentDerivation, IntentInput } from '../intents/application/derive-intent.js';

// Re-export DTO types + converters for backward-compatible imports from
// './service.js' (these previously lived here; logic now in ./helpers.ts).
export { findingRowToDto, reviewToDto } from './helpers.js';
export type { ReviewDto, ReviewDtoFinding } from './helpers.js';

export type ReviewRepositoryPort = Pick<
  ReviewRepository,
  | 'deleteReview'
  | 'activeRunsForPull'
  | 'listRunsForPull'
  | 'getMcpRunRecord'
  | 'deleteAgentRun'
  | 'cancelRunIfRunning'
  | 'reapStaleRunningRuns'
  | 'getPull'
  | 'getDerivedIntent'
  | 'getRepo'
  | 'createAgentRun'
  | 'reviewsForPull'
  | 'latestReviewsForPull'
  | 'getRunTrace'
  | 'getFinding'
  | 'findingContext'
  | 'setFindingAccepted'
  | 'setFindingDismissed'
>;

export interface ReviewServiceDependencies {
  repository: ReviewRepositoryPort;
  agents: Pick<AgentsRepository, 'listEnabled' | 'getById' | 'getByIds'>;
  executor: Pick<ReviewRunExecutor, 'executeRuns'>;
  runBus: Pick<RunBus, 'cancel' | 'complete' | 'publish'>;
  /** Intentionally separate from review execution so intent can be refreshed on demand. */
  intentDeriver: Pick<{ derive(input: IntentInput): Promise<IntentDerivation> }, 'derive'>;
}

/**
 * Review service (the core). Orchestrates:
 *   diff → assemblePrompt(system + repo-map + diff)
 *        → llm.completeStructured({ schema: Review }) (single-pass)
 *        → groundFindings(...) (citation gate — drops findings off the diff)
 *        → persist reviews + kept findings (+ grounding summary)
 *   while streaming RunEvents over the injected run-bus port, and on completion writing
 *   the whole log as ONE RunTrace doc + an agent_runs row.
 *
 * Also: the finding accept/dismiss actions. The bulky run execution lives in
 * run-executor; this class keeps the public method surface.
 */
export class ReviewService {
  constructor(private readonly dependencies: ReviewServiceDependencies) {}

  // ===========================================================================
  // Run a review for one or all enabled agents on a PR.
  // ===========================================================================

  /**
   * Resolve which agents to run. `all` → all enabled agents; else a single agent.
   */
  async resolveTargets(
    workspaceId: string,
    opts: { agentId?: string; agentIds?: string[]; all?: boolean },
  ): Promise<AgentRow[]> {
    if (opts.all) return this.dependencies.agents.listEnabled(workspaceId);
    if (opts.agentIds?.length) {
      const agentIds = [...new Set(opts.agentIds)];
      const agents = await this.dependencies.agents.getByIds(workspaceId, agentIds);
      const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
      if (agentsById.size !== agentIds.length) throw new NotFoundError('Agent not found');
      return agentIds.map((agentId) => agentsById.get(agentId)!);
    }
    if (opts.agentId) {
      const agent = await this.dependencies.agents.getById(workspaceId, opts.agentId);
      if (!agent) throw new NotFoundError('Agent not found');
      return [agent];
    }
    throw new AppError('invalid_run_request', 'Provide agentId or all:true', 400);
  }

  /** Delete a whole review run (one agent's pass) + its findings (cascade). */
  async deleteReview(workspaceId: string, reviewId: string): Promise<boolean> {
    return this.dependencies.repository.deleteReview(workspaceId, reviewId);
  }

  /** In-flight runs for a PR (server-side source of truth, survives reload). */
  async activeRuns(workspaceId: string, prId: string) {
    return this.dependencies.repository.activeRunsForPull(workspaceId, prId);
  }

  /** All runs for a PR (any status), newest first — the run history (incl. failures). */
  async listRuns(workspaceId: string, prId: string) {
    return this.dependencies.repository.listRunsForPull(workspaceId, prId);
  }

  /** Delete one run from the history (+ its trace). */
  async deleteRun(workspaceId: string, runId: string): Promise<boolean> {
    return this.dependencies.repository.deleteAgentRun(workspaceId, runId);
  }

  /**
   * Cancel an in-flight run. Signals a live runner to stop at its next
   * checkpoint AND marks the DB row cancelled + completes the bus immediately —
   * so cancel also works for ORPHANED runs (whose background process died on a
   * server restart) where signalling alone would do nothing.
   */
  async cancelRun(runId: string): Promise<void> {
    this.publish(runId, 'info', 'Cancellation requested — stopping…');
    this.dependencies.runBus.cancel(runId);
    await this.dependencies.repository.cancelRunIfRunning(runId);
    this.dependencies.runBus.complete(runId);
  }

  /** Reap runs left 'running' by a previous (now-dead) process. Called on boot. */
  async reapStaleRuns(): Promise<number> {
    return this.dependencies.repository.reapStaleRunningRuns();
  }

  /**
   * Run a review for each target agent. Each agent gets its own runId
   * (= agent_runs.id) created up-front so the SSE route can be subscribed
   * before/while the run progresses. A partial failure in one agent does not
   * abort the others.
   */
  async runReview(
    workspaceId: string,
    prId: string,
    targets: AgentRow[],
    logger?: Logger,
  ): Promise<{ runs: { run_id: string; agent_id: string; agent_name: string }[]; reviews: ReviewDto[] }> {
    const pull = await this.dependencies.repository.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repo = await this.dependencies.repository.getRepo(pull.repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    // Create the agent_run rows up front so a runId is available IMMEDIATELY —
    // the client persists these in global state and subscribes to the SSE
    // stream. The actual (slow) review runs in the background below.
    const jobs = await Promise.all(
      targets.map(async (agent) => ({
        agent,
        runId: await this.dependencies.repository.createAgentRun({
          workspaceId,
          prId,
          agentId: agent.id,
          provider: agent.provider,
          model: agent.model,
        }),
      })),
    );
    const runs = jobs.map(({ agent, runId }) => ({
      run_id: runId,
      agent_id: agent.id,
      agent_name: agent.name,
    }));

    // Fire-and-forget: the HTTP response returns now with the runIds; reviews
    // are persisted as each agent finishes and the client refetches on SSE done.
    void this.dependencies.executor.executeRuns(workspaceId, pull, repo, jobs, logger).catch((err) => {
      logger?.error({ prId, err: (err as Error).message }, 'review: background execution crashed');
    });

    return { runs, reviews: [] };
  }

  private publish(runId: string, kind: RunEventKind, msg: string, data?: unknown) {
    return this.dependencies.runBus.publish(runId, kind, msg, data);
  }

  // ===========================================================================
  // Finding actions
  // ===========================================================================

  async actOnFinding(
    workspaceId: string,
    findingId: string,
    action: FindingActionKind,
  ): Promise<{ finding: ReviewDtoFinding }> {
    return actOnFindingImpl(this.dependencies.repository, workspaceId, findingId, action);
  }

  // ===========================================================================
  // Reads
  // ===========================================================================

  async reviewsForPull(workspaceId: string, prId: string, options: { latestPerAgent?: boolean } = {}): Promise<ReviewDto[]> {
    const pull = await this.dependencies.repository.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const rows = options.latestPerAgent
      ? await this.dependencies.repository.latestReviewsForPull(prId)
      : await this.dependencies.repository.reviewsForPull(prId);
    const names = new Map<string, string>();
    for (const { review } of rows) {
      if (review.agentId && !names.has(review.agentId)) {
        const a = await this.dependencies.agents.getById(workspaceId, review.agentId);
        if (a) names.set(review.agentId, a.name);
      }
    }
    return rows.map(({ review, findings }) =>
      reviewToDto(review, findings, review.agentId ? names.get(review.agentId) : null),
    );
  }

  /** Safe, bounded persisted result for one run in the current workspace. */
  async mcpRunFindings(workspaceId: string, runId: string): Promise<McpRunResult> {
    const record = await this.dependencies.repository.getMcpRunRecord(workspaceId, runId);
    if (!record) throw new NotFoundError('Review run not found');
    return toMcpRunResult(record);
  }

  /** The persisted, source-safe intent for a pull request in this workspace. */
  async derivedIntent(workspaceId: string, prId: string): Promise<DerivedIntent | null> {
    const pull = await this.dependencies.repository.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    return (await this.dependencies.repository.getDerivedIntent(prId)) ?? null;
  }

  /** Rebuild intent only; it does not create review runs or findings. */
  async rerunIntent(workspaceId: string, prId: string): Promise<DerivedIntent | null> {
    const pull = await this.dependencies.repository.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repo = await this.dependencies.repository.getRepo(pull.repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    const result = await this.dependencies.intentDeriver.derive({
      workspaceId,
      prId: pull.id,
      title: pull.title,
      body: pull.body,
      repo: { owner: repo.owner, name: repo.name },
      force: true,
    });
    // A transient derivation failure must preserve a previously safe intent.
    return result.status === 'derived'
      ? result.intent
      : (await this.dependencies.repository.getDerivedIntent(prId)) ?? null;
  }

  async getRunTrace(runId: string): Promise<RunTraceResponse | undefined> {
    return this.dependencies.repository.getRunTrace(runId);
  }
}
