import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DerivedIntent, McpRunFindings, RunRequest, SmartDiffResponse } from '@devdigest/shared';
import type { RunEvent } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { createReviewService, createSmartDiffService } from './composition.js';
import type { McpRunResult } from './application/mcp-run-findings.js';

/**
 * reviews module.
 *   POST   /pulls/:id/review  {agentId} | {all:true}  → run review(s); returns runs
 *   GET    /runs/:id/events                            → SSE stream of RunEvent (replay-first)
 *   GET    /runs/:id/trace                             → the single-document RunTrace
 *   GET    /pulls/:id/reviews                          → persisted reviews + findings for a PR
 *   POST   /findings/:id/(accept|dismiss)              → finding actions
 */
const FINDING_ACTIONS = ['accept', 'dismiss'] as const;
const ReviewsQuery = z.object({ latest_per_agent: z.enum(['true', 'false']).optional() });
export default async function reviewsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = createReviewService(container);
  const smartDiff = createSmartDiffService(container);
  const eventStream = (streamId: string, terminalEvent?: RunEvent) =>
    (async function* () {
      if (!container.runBus.hasStream(streamId)) {
        if (terminalEvent) yield { id: String(terminalEvent.seq), event: terminalEvent.kind, data: JSON.stringify(terminalEvent) };
        return;
      }
      const queue: RunEvent[] = [];
      let resolve: (() => void) | null = null;
      let done = false;

      const unsubscribe = container.runBus.subscribe(streamId, (event) => {
        queue.push(event);
        resolve?.();
      });
      const offDone = container.runBus.onDone(streamId, () => {
        done = true;
        resolve?.();
      });

      try {
        while (true) {
          if (queue.length === 0) {
            if (done) break;
            await new Promise<void>((next) => (resolve = next));
            resolve = null;
            continue;
          }
          const event = queue.shift()!;
          yield { id: String(event.seq), event: event.kind, data: JSON.stringify(event) };
        }
      } finally {
        unsubscribe();
        offDone();
      }
    })();

  // ---- Run a review (manual trigger) -------------------------------
  // Tight per-route limit: each call can fan out to expensive LLM runs.
  // Body stays a tolerant manual parse (both fields optional; empty body is OK).
  app.post(
    '/pulls/:id/review',
    { schema: { params: IdParams }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
    const { workspaceId } = await getContext(container, req);
    const body = RunRequest.parse(req.body ?? {});
    const targets = await service.resolveTargets(workspaceId, {
      ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
      ...(body.agentIds !== undefined ? { agentIds: body.agentIds } : {}),
      ...(body.all !== undefined ? { all: body.all } : {}),
    });
    const { runs, reviews } = await service.runReview(
      workspaceId,
      req.params.id,
      targets,
      req.log,
    );
    return { pr_id: req.params.id, runs, reviews };
  });

  // ---- SSE: live run events (replay buffer first, then live; ends on done) -
  // No rate limit: SSE is one long-lived connection, not burst traffic.
  app.get(
    '/runs/:id/events',
    { schema: { params: IdParams }, config: { rateLimit: false } },
    async (req, reply) => {
    await getContext(container, req);
    reply.sse(eventStream(req.params.id));
  });

  // Intent enrichment can outlive individual agent runs. It therefore gets a
  // PR-scoped completion stream, avoiding one lingering SSE connection per
  // agent while still allowing the overview to refresh when intent persists.
  app.get(
    '/pulls/:id/intent/events',
    { schema: { params: IdParams }, config: { rateLimit: false } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      await service.derivedIntent(workspaceId, req.params.id);
      const streamId = `pull-intent:${req.params.id}`;
      reply.sse(eventStream(streamId, {
        runId: streamId,
        seq: 0,
        kind: 'result',
        msg: 'PR intent derivation is not active',
        t: new Date().toISOString(),
        data: { intentSettled: true },
      }));
    },
  );

  app.get('/runs/:id/findings', { schema: { params: IdParams, response: { 200: McpRunFindings } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return toMcpRunFindingsResponse(await service.mcpRunFindings(workspaceId, req.params.id));
  });

  // ---- Active (in-flight) runs for a PR (server source of truth) ----------
  app.get('/pulls/:id/runs/active', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.activeRuns(workspaceId, req.params.id);
  });

  // ---- All runs for a PR (any status; the run history, incl. failures) -----
  app.get('/pulls/:id/runs', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.listRuns(workspaceId, req.params.id);
  });

  // ---- Delete one run from the history (+ its trace) ----------------------
  app.delete('/runs/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    const ok = await service.deleteRun(workspaceId, req.params.id);
    return { ok };
  });

  // ---- Cancel an in-flight run --------------------------------------------
  app.post('/runs/:id/cancel', { schema: { params: IdParams } }, async (req) => {
    await getContext(container, req);
    await service.cancelRun(req.params.id);
    return { ok: true };
  });

  // ---- Run trace (single document; A5 enriches with multi-agent/stats) ----
  app.get('/runs/:id/trace', { schema: { params: IdParams } }, async (req) => {
    await getContext(container, req);
    const trace = await service.getRunTrace(req.params.id);
    if (!trace) throw new NotFoundError('Run trace not found');
    return trace;
  });

  // ---- Reads --------------------------------------------------------------
  app.get('/pulls/:id/smart-diff', { schema: { params: IdParams, response: { 200: SmartDiffResponse } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return smartDiff.execute(workspaceId, req.params.id);
  });

  app.get('/pulls/:id/intent', { schema: { params: IdParams, response: { 200: DerivedIntent.nullable() } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.derivedIntent(workspaceId, req.params.id);
  });

  // Intent is a single model call and must not create a full review run.
  app.post('/pulls/:id/intent', {
    schema: { params: IdParams, response: { 200: DerivedIntent.nullable() } },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.rerunIntent(workspaceId, req.params.id);
  });

  app.get('/pulls/:id/reviews', { schema: { params: IdParams, querystring: ReviewsQuery } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.reviewsForPull(workspaceId, req.params.id, { latestPerAgent: req.query.latest_per_agent === 'true' });
  });

  // ---- Delete a whole review run (one agent's pass) + its findings --------
  app.delete('/reviews/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    const ok = await service.deleteReview(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Review not found');
    return { ok: true };
  });

  // ---- Finding actions (accept / dismiss) ---------------------------------
  for (const action of FINDING_ACTIONS) {
    app.post(`/findings/:id/${action}`, { schema: { params: IdParams } }, async (req) => {
      const { workspaceId } = await getContext(container, req);
      const result = await service.actOnFinding(workspaceId, req.params.id, action);
      return result;
    });
  }
}

/** HTTP adapter for the application result; Zod validation stays at this boundary. */
function toMcpRunFindingsResponse(result: McpRunResult) {
  return McpRunFindings.parse({
    run_id: result.runId,
    status: result.status,
    error: result.error,
    verdict: result.verdict,
    summary: result.summary,
    score: result.score,
    severity_counts: result.severityCounts,
    findings_truncated: result.findingsTruncated,
    findings: result.findings.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      file: finding.file,
      start_line: finding.startLine,
      end_line: finding.endLine,
      rationale: finding.rationale,
      suggestion: finding.suggestion,
      confidence: finding.confidence,
      kind: finding.kind,
    })),
  });
}
