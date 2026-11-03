import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { EvalPipelineCase, EvalPipelineRun } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { CaseConflict, createCase, type CaseRecord } from './application/cases.js';
import { CaseCreationError } from './application/create-case.js';
import { createCasesRepository, createEvalSuiteService } from './composition.js';
import { admittedCase, PromotionError, SuiteAdmissionError } from './infrastructure/suite-repository.js';
import { listFixtures, resolveFixture } from './infrastructure/prepared-fixtures.js';
import type { evalSuiteRuns } from '../../db/schema.js';
import { ManualCaseError } from './infrastructure/cases-repository.js';

const ManualCaseBody = z.object({ name: z.string().trim().min(1).max(200), diff: z.string().min(1).max(256 * 1024), expectation: z.enum(['must_find', 'must_not_flag']), anchor: z.object({ file: z.string().min(1).max(1024), start_line: z.number().int().positive(), end_line: z.number().int().positive() }) }).strict();

function toDto(record: CaseRecord): z.infer<typeof EvalPipelineCase> {
  return { id: record.id, agent_id: record.agentId, finding_id: record.findingId, name: record.name,
    expectation: record.expectation, fixture_id: record.fixtureId, fixture_hash: record.fixtureHash,
    anchor: { file: record.anchor.file, start_line: record.anchor.startLine, end_line: record.anchor.endLine } };
}

function runDto(row: typeof evalSuiteRuns.$inferSelect): z.infer<typeof EvalPipelineRun> {
  return { id: row.id, agent_id: row.agentId, status: row.status as z.infer<typeof EvalPipelineRun>['status'],
    dataset_fingerprint: row.datasetFingerprint, engine_version: row.engineVersion, scorer_version: row.scorerVersion,
    snapshot: EvalPipelineRun.shape.snapshot.parse(row.snapshot), result: EvalPipelineRun.shape.result.parse(row.result), created_at: row.createdAt.toISOString(), finished_at: row.finishedAt?.toISOString() ?? null };
}

export default async function evalRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const cases = createCasesRepository(app.container);
  const suites = createEvalSuiteService(app.container);
  app.get('/eval-fixtures', { schema: { response: { 200: z.array(z.object({ id: z.string(), anchor: z.object({ file: z.string(), startLine: z.number(), endLine: z.number() }), diff: z.string(), metadata: z.object({ title: z.string(), description: z.string().nullable() }) })) } } }, async (req) => {
    await getContext(app.container, req);
    return [...listFixtures()];
  });
  app.post('/findings/:id/eval-cases', { schema: { params: IdParams, body: z.object({}).optional(), response: { 200: EvalPipelineCase, 201: EvalPipelineCase } } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    try {
      const result = await createCase(cases, workspaceId, req.params.id);
      if (!result) throw new NotFoundError('Finding not found');
      return reply.code(result.created ? 201 : 200).send(toDto(result.value));
    } catch (error) {
      if (error instanceof CaseCreationError) {
        const messages = { undecided: 'Accept or dismiss the finding first.', missing_agent: 'The finding has no producing agent.', provenance_unavailable: 'The original review diff is unavailable or has changed.', input_too_large: 'The original review diff exceeds 256 KiB.', sensitive_input: 'The original review input contains a possible secret and was not saved.' };
        throw new AppError(error.code, messages[error.code], error.code === 'input_too_large' ? 422 : 409);
      }
      if (error instanceof CaseConflict) throw new AppError(error.code, 'The finding decision changed or conflicts with an existing case.', 409);
      throw error;
    }
  });
  app.get('/agents/:id/eval-cases', { schema: { params: IdParams, response: { 200: z.array(EvalPipelineCase) } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    if (!await cases.agentExists(workspaceId, req.params.id)) throw new NotFoundError('Agent not found');
    return (await cases.list(workspaceId, req.params.id)).map(toDto);
  });
  app.post('/agents/:id/eval-cases', { schema: { params: IdParams, body: ManualCaseBody, response: { 201: EvalPipelineCase } } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    try {
      const { name, diff, expectation, anchor } = req.body;
      const item = await cases.saveManual(workspaceId, req.params.id, { name, diff, expectation, anchor: { file: anchor.file, startLine: anchor.start_line, endLine: anchor.end_line } });
      return reply.code(201).send(toDto(item));
    } catch (error) { if (error instanceof ManualCaseError) { if (error.code === 'not_found') throw new NotFoundError('Agent not found'); throw new AppError(error.code, error.code === 'invalid_input' ? 'The diff or anchor is invalid.' : 'This label conflicts with an existing case.', error.code === 'invalid_input' ? 422 : 409); } throw error; }
  });
  app.put('/agents/:id/eval-cases/:caseId', { schema: { params: IdParams.extend({ caseId: z.string().uuid() }), body: ManualCaseBody, response: { 200: EvalPipelineCase } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    try {
      const { name, diff, expectation, anchor } = req.body;
      return toDto(await cases.saveManual(workspaceId, req.params.id, { name, diff, expectation, anchor: { file: anchor.file, startLine: anchor.start_line, endLine: anchor.end_line } }, req.params.caseId));
    } catch (error) { if (error instanceof ManualCaseError) { if (error.code === 'not_found') throw new NotFoundError('Eval case not found'); throw new AppError(error.code, error.code === 'invalid_input' ? 'The diff or anchor is invalid.' : 'This label conflicts with an existing case.', error.code === 'invalid_input' ? 422 : 409); } throw error; }
  });
  app.get('/agents/:id/eval-cases/:caseId', { schema: { params: IdParams.extend({ caseId: z.string().uuid() }), response: { 200: EvalPipelineCase.extend({ diff: z.string() }) } } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const item = (await cases.list(workspaceId, req.params.id)).find((entry) => entry.id === req.params.caseId);
    if (!item) throw new NotFoundError('Eval case not found');
    let validated;
    try { validated = admittedCase(item.id, item); } catch { throw new AppError('fixture_unavailable', 'Eval input is unavailable.', 409); }
    const diff = validated.diff ?? resolveFixture(validated.fixtureId, validated.fixtureHash)?.diff;
    if (!diff) throw new AppError('fixture_unavailable', 'Eval input is unavailable.', 409);
    return reply.header('Cache-Control', 'no-store').send({ ...toDto(item), diff });
  });
  app.patch('/agents/:id/eval-cases/:caseId', { schema: { params: IdParams.extend({ caseId: z.string().uuid() }), body: z.object({ name: z.string().trim().min(1).max(200) }), response: { 200: z.object({ ok: z.literal(true) }) } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    if (!await cases.rename(workspaceId, req.params.id, req.params.caseId, req.body.name)) throw new NotFoundError('Eval case not found');
    return { ok: true as const };
  });
  app.delete('/agents/:id/eval-cases/:caseId', { schema: { params: IdParams.extend({ caseId: z.string().uuid() }), response: { 200: z.object({ ok: z.literal(true) }) } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    if (!await cases.remove(workspaceId, req.params.id, req.params.caseId)) throw new NotFoundError('Eval case not found');
    return { ok: true as const };
  });
  app.post('/agents/:id/eval-runs', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, schema: { params: IdParams, response: { 202: EvalPipelineRun } } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    try { return reply.code(202).send(runDto(await suites.start(workspaceId, req.params.id))); }
    catch (error) {
      if (error instanceof SuiteAdmissionError) {
        if (error.code === 'not_found') throw new NotFoundError('Agent not found');
        throw new AppError(error.code, error.code === 'empty' ? 'Create an eval case first.' : error.code === 'active' ? 'An eval run is already active.' : error.code === 'fixture_unavailable' ? 'An eval input is missing or has changed.' : 'Eval set exceeds its limits.', error.code === 'limit' ? 422 : 409);
      }
      throw error;
    }
  });
  app.post('/eval-runs/batch', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, schema: {
    body: z.object({}).strict(),
    response: { 202: z.array(z.object({ agent_id: z.string().uuid(), run: EvalPipelineRun.nullable(), error: z.enum(['not_found', 'empty', 'active', 'limit', 'fixture_unavailable', 'capacity', 'internal']).nullable() })) },
  } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const agentIds = await suites.repository.agentIds(workspaceId);
    if (agentIds.length > 100) throw new AppError('limit', 'A batch supports up to 100 agents.', 422);
    const results: Array<{ agent_id: string; run: z.infer<typeof EvalPipelineRun> | null; error: 'not_found' | 'empty' | 'active' | 'limit' | 'fixture_unavailable' | 'capacity' | 'internal' | null }> = [];
    for (const agentId of agentIds) {
      try { results.push({ agent_id: agentId, run: runDto(await suites.start(workspaceId, agentId)), error: null }); }
      catch (error) { results.push({ agent_id: agentId, run: null, error: error instanceof SuiteAdmissionError ? error.code : 'internal' }); }
    }
    return reply.code(202).send(results);
  });
  app.post('/agents/:id/eval-cases/:caseId/runs', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, schema: { params: IdParams.extend({ caseId: z.string().uuid() }), response: { 202: EvalPipelineRun } } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    try { return reply.code(202).send(runDto(await suites.start(workspaceId, req.params.id, req.params.caseId))); }
    catch (error) {
      if (error instanceof SuiteAdmissionError) {
        if (error.code === 'not_found') throw new NotFoundError('Agent or eval case not found');
        throw new AppError(error.code, error.code === 'active' ? 'An eval run is already active.' : 'Eval input is unavailable.', error.code === 'limit' ? 422 : 409);
      }
      throw error;
    }
  });
  app.get('/agents/:id/eval-runs', { schema: { params: IdParams, response: { 200: z.array(EvalPipelineRun) } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    if (!await cases.agentExists(workspaceId, req.params.id)) throw new NotFoundError('Agent not found');
    return (await suites.repository.list(workspaceId, req.params.id)).map(runDto);
  });
  app.get('/eval-runs/:id', { schema: { params: IdParams, response: { 200: EvalPipelineRun } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const run = await suites.repository.get(workspaceId, req.params.id);
    if (!run) throw new NotFoundError('Eval run not found');
    return runDto(run);
  });
  app.post('/agents/:id/eval-runs/:runId/promote', { schema: { params: IdParams.extend({ runId: z.string().uuid() }), body: z.object({ expected_version: z.number().int().positive() }).strict(), response: { 200: z.object({ version: z.number().int() }) } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    try { const agent = await suites.repository.promote(workspaceId, req.params.id, req.params.runId, req.body.expected_version); return { version: agent.version }; }
    catch (error) { if (error instanceof PromotionError) { if (error.code === 'not_found') throw new NotFoundError('Agent or run not found'); throw new AppError(error.code, error.code === 'stale_agent' ? 'The agent changed. Reload before promoting.' : error.code === 'skills_changed' ? 'A tested skill changed or was removed.' : 'The run does not contain a complete promotable snapshot.', 409); } throw error; }
  });
  app.get('/eval-dashboard', { schema: { response: { 200: z.array(EvalPipelineRun) } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return (await suites.repository.list(workspaceId)).map(runDto);
  });
}
