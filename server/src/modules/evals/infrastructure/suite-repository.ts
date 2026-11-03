import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import { EvalPipelineSnapshot, EvalPipelineResult } from '@devdigest/shared';
import { z } from 'zod';
import { isUnsafeSkillContent } from '../../../vendor/shared/skill-safety.js';
import { datasetFingerprint, EVAL_SCORER_VERSION } from '../application/dataset.js';
import type { EvalAgentSnapshot, EvalCaseSnapshot, SuiteResult } from '../application/run-suite.js';
import { resolveFixture } from './prepared-fixtures.js';
import { createHash } from 'node:crypto';
import { originalFragment } from './original-input.js';

// Fallback runs cannot establish the identity of the code and injected providers.
export const EVAL_ENGINE_VERSION = 'unavailable';
export class SuiteAdmissionError extends Error {
  constructor(public readonly code: 'not_found' | 'empty' | 'active' | 'limit' | 'fixture_unavailable' | 'capacity') { super(code); }
}
export class PromotionError extends Error {
  constructor(public readonly code: 'not_found' | 'stale_agent' | 'snapshot_unavailable' | 'skills_changed') { super(code); }
}

// Historical JSON may contain raw source or arbitrary extra fields. Parse into
// a fresh whitelist before the value is used, hashed, returned or persisted.
const StoredCase = z.object({
  expectation: z.enum(['must_find', 'must_not_flag']),
  anchor: z.object({ file: z.string().min(1).max(1024), startLine: z.number().int().positive(), endLine: z.number().int().positive() })
    .refine((anchor) => anchor.startLine <= anchor.endLine),
  fixtureId: z.string().min(1).max(256),
  fixtureHash: z.string().regex(/^[a-f0-9]{64}$/),
  diff: z.string().max(256 * 1024).optional(),
});

export function admittedCase(id: string, snapshot: unknown): EvalCaseSnapshot {
  const parsed = StoredCase.safeParse(snapshot);
  if (!parsed.success) throw new SuiteAdmissionError('fixture_unavailable');
  const fixture = resolveFixture(parsed.data.fixtureId, parsed.data.fixtureHash);
  const validOriginal = (parsed.data.fixtureId === 'original-review' || parsed.data.fixtureId === 'manual') && parsed.data.diff !== undefined && Buffer.byteLength(parsed.data.diff) <= 256 * 1024 && createHash('sha256').update(parsed.data.diff).digest('hex') === parsed.data.fixtureHash && originalFragment(parsed.data.diff, parsed.data.fixtureHash, parsed.data.anchor) === parsed.data.diff;
  if (!validOriginal && (!fixture || fixture.anchor.file !== parsed.data.anchor.file || fixture.anchor.startLine !== parsed.data.anchor.startLine || fixture.anchor.endLine !== parsed.data.anchor.endLine)) throw new SuiteAdmissionError('fixture_unavailable');
  return { id, expectation: parsed.data.expectation, anchor: { file: parsed.data.anchor.file,
    startLine: parsed.data.anchor.startLine, endLine: parsed.data.anchor.endLine },
    fixtureId: parsed.data.fixtureId, fixtureHash: parsed.data.fixtureHash, ...(validOriginal ? { diff: parsed.data.diff! } : {}) };
}

export class SuiteRepository {
  constructor(private readonly db: Db, private readonly engineVersion = EVAL_ENGINE_VERSION) {}
  async agentIds(workspaceId: string) {
    return (await this.db.select({ id: t.agents.id }).from(t.agents).where(eq(t.agents.workspaceId, workspaceId)).orderBy(t.agents.id).limit(101)).map((row) => row.id);
  }
  async admit(workspaceId: string, agentId: string, caseId?: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${workspaceId}:${agentId}`}, 0))`);
      const [agent] = await tx.select().from(t.agents).where(and(eq(t.agents.id, agentId), eq(t.agents.workspaceId, workspaceId))).for('update');
      if (!agent) throw new SuiteAdmissionError('not_found');
      const [active] = await tx.select({ id: t.evalSuiteRuns.id }).from(t.evalSuiteRuns).where(and(eq(t.evalSuiteRuns.workspaceId, workspaceId), eq(t.evalSuiteRuns.agentId, agentId), inArray(t.evalSuiteRuns.status, ['queued', 'running'])));
      if (active) throw new SuiteAdmissionError('active');
      const rows = await tx.select({ id: t.evalCases.id, snapshot: t.evalCaseSources.snapshot }).from(t.evalCases)
        .innerJoin(t.evalCaseSources, eq(t.evalCases.id, t.evalCaseSources.caseId))
        .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.ownerId, agentId), eq(t.evalCases.ownerKind, 'agent'), eq(t.evalCaseSources.workspaceId, workspaceId)))
        .orderBy(t.evalCases.id);
      if (caseId) {
        const selected = rows.filter((row) => row.id === caseId);
        if (!selected.length) throw new SuiteAdmissionError('not_found');
        rows.splice(0, rows.length, ...selected);
      }
      if (!rows.length) throw new SuiteAdmissionError('empty');
      if (rows.length > 100) throw new SuiteAdmissionError('limit');
      const cases = rows.map((row) => admittedCase(row.id, row.snapshot));
      const links = await tx.select({ id: t.skills.id, order: t.agentSkills.order, body: t.skills.body, skillEnabled: t.skills.enabled, linkEnabled: t.agentSkills.enabled }).from(t.agentSkills)
        .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
        .where(and(eq(t.agentSkills.agentId, agentId), eq(t.skills.workspaceId, workspaceId))).orderBy(t.agentSkills.order);
      const config: EvalAgentSnapshot = { systemPrompt: agent.systemPrompt, provider: agent.provider, model: agent.model, strategy: agent.strategy,
        skills: links.filter((link) => link.skillEnabled && link.linkEnabled && !isUnsafeSkillContent(link.body)).map((link) => link.body) };
      const promotion = { name: agent.name, description: agent.description, provider: agent.provider, model: agent.model, systemPrompt: agent.systemPrompt,
        outputSchema: agent.outputSchema ?? null, strategy: agent.strategy, ciFailOn: agent.ciFailOn, repoIntel: agent.repoIntel, enabled: agent.enabled,
        links: links.map((link) => ({ id: link.id, order: link.order, enabled: link.linkEnabled, skillEnabled: link.skillEnabled, bodyHash: createHash('sha256').update(link.body).digest('hex') })) };
      const [run] = await tx.insert(t.evalSuiteRuns).values({ workspaceId, agentId, status: 'queued', datasetFingerprint: datasetFingerprint(cases),
        engineVersion: this.engineVersion, scorerVersion: EVAL_SCORER_VERSION, snapshot: { scope: caseId ? 'case' : 'suite', agent: config, cases, promotion } }).returning();
      return { run: run!, agent: config, cases };
    });
  }
  async promote(workspaceId: string, agentId: string, runId: string, expectedVersion: number) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${workspaceId}:${agentId}`}, 0))`);
      const [agent] = await tx.select().from(t.agents).where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, agentId))).for('update');
      const [run] = await tx.select().from(t.evalSuiteRuns).where(and(eq(t.evalSuiteRuns.workspaceId, workspaceId), eq(t.evalSuiteRuns.agentId, agentId), eq(t.evalSuiteRuns.id, runId)));
      if (!agent || !run) throw new PromotionError('not_found');
      if (agent.version !== expectedVersion) throw new PromotionError('stale_agent');
      const snapshot = EvalPipelineSnapshot.safeParse(run.snapshot);
      const promotion = snapshot.success ? snapshot.data.promotion : undefined;
      const result = EvalPipelineResult.safeParse(run.result);
      if (run.status !== 'completed' || !result.success || result.data.status !== 'completed' || !result.data.score || !promotion || !snapshot.success || snapshot.data.scope !== 'suite' || result.data.results.length !== snapshot.data.cases.length || result.data.results.some((item) => item.status !== 'completed') || new Set(promotion.links.map((link) => link.id)).size !== promotion.links.length) throw new PromotionError('snapshot_unavailable');
      const currentSkills = promotion.links.length ? await tx.select().from(t.skills).where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, promotion.links.map((link) => link.id)))).for('update') : [];
      if (currentSkills.length !== promotion.links.length || promotion.links.some((link) => { const skill = currentSkills.find((item) => item.id === link.id); return !skill || skill.enabled !== link.skillEnabled || createHash('sha256').update(skill.body).digest('hex') !== link.bodyHash; })) throw new PromotionError('skills_changed');
      const replaySkills = promotion.links.filter((link) => link.enabled && link.skillEnabled).map((link) => currentSkills.find((skill) => skill.id === link.id)!).filter((skill) => !isUnsafeSkillContent(skill.body)).map((skill) => skill.body);
      if (promotion.provider !== snapshot.data.agent.provider || promotion.model !== snapshot.data.agent.model || promotion.systemPrompt !== snapshot.data.agent.systemPrompt || promotion.strategy !== snapshot.data.agent.strategy || JSON.stringify(replaySkills) !== JSON.stringify(snapshot.data.agent.skills)) throw new PromotionError('snapshot_unavailable');
      const nextVersion = agent.version + 1;
      const [updated] = await tx.update(t.agents).set({ name: promotion.name, description: promotion.description, provider: promotion.provider, model: promotion.model, systemPrompt: promotion.systemPrompt,
        outputSchema: promotion.outputSchema as object | null, strategy: promotion.strategy, ciFailOn: promotion.ciFailOn, repoIntel: promotion.repoIntel, enabled: promotion.enabled, version: nextVersion }).where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, agentId), eq(t.agents.version, expectedVersion))).returning();
      if (!updated) throw new PromotionError('stale_agent');
      await tx.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
      if (promotion.links.length) await tx.insert(t.agentSkills).values(promotion.links.map((link) => ({ agentId, skillId: link.id, order: link.order, enabled: link.enabled })));
      await tx.insert(t.agentVersions).values({ agentId, version: nextVersion, configJson: { provider: promotion.provider, model: promotion.model, system_prompt: promotion.systemPrompt, output_schema: promotion.outputSchema, strategy: promotion.strategy, ci_fail_on: promotion.ciFailOn, repo_intel: promotion.repoIntel, skills: promotion.links.map((link) => link.id) } });
      return updated;
    }, { isolationLevel: 'serializable' });
  }
  async markRunning(workspaceId: string, id: string) {
    await this.db.update(t.evalSuiteRuns).set({ status: 'running' }).where(and(eq(t.evalSuiteRuns.workspaceId, workspaceId), eq(t.evalSuiteRuns.id, id), eq(t.evalSuiteRuns.status, 'queued')));
  }
  async finish(workspaceId: string, id: string, result: SuiteResult) {
    await this.db.update(t.evalSuiteRuns).set({ status: result.status, result, finishedAt: new Date() }).where(and(eq(t.evalSuiteRuns.workspaceId, workspaceId), eq(t.evalSuiteRuns.id, id), inArray(t.evalSuiteRuns.status, ['queued', 'running'])));
  }
  async list(workspaceId: string, agentId?: string) {
    const rows = await this.db.select().from(t.evalSuiteRuns).where(agentId ? and(eq(t.evalSuiteRuns.workspaceId, workspaceId), eq(t.evalSuiteRuns.agentId, agentId)) : eq(t.evalSuiteRuns.workspaceId, workspaceId)).orderBy(desc(t.evalSuiteRuns.createdAt));
    return rows.filter((row) => EvalPipelineSnapshot.safeParse(row.snapshot).success);
  }
  async get(workspaceId: string, id: string) {
    const [row] = await this.db.select().from(t.evalSuiteRuns).where(and(eq(t.evalSuiteRuns.workspaceId, workspaceId), eq(t.evalSuiteRuns.id, id)));
    return row && EvalPipelineSnapshot.safeParse(row.snapshot).success ? row : undefined;
  }
  async reap() {
    await this.db.update(t.evalSuiteRuns).set({ status: 'failed', finishedAt: new Date() }).where(inArray(t.evalSuiteRuns.status, ['queued', 'running']));
  }
}
