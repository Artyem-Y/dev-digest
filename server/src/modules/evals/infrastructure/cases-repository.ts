import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import { CaseConflict, type CaseRecord, type CasesPort } from '../application/cases.js';
import type { SourceFinding } from '../application/create-case.js';
import { hasContradictoryLabels } from '../application/dataset.js';
import type { EvalCaseSnapshot } from '../application/run-suite.js';
import { findFixture, fixtureHash } from './prepared-fixtures.js';
import { createHash } from 'node:crypto';
import { originalFragment } from './original-input.js';
import type { UnifiedDiff } from '@devdigest/shared';
import type { PullRow } from '../../reviews/repository.js';

export class ManualCaseError extends Error {
  constructor(public readonly code: 'not_found' | 'invalid_input' | 'contradictory_labels') { super(code); }
}
export type ManualCaseInput = { name: string; diff: string; expectation: 'must_find' | 'must_not_flag'; anchor: { file: string; startLine: number; endLine: number } };

export class CasesRepository implements CasesPort {
  constructor(private readonly db: Db, private readonly loadOriginal?: (workspaceId: string, pull: PullRow, repo: { owner: string; name: string }, revisions?: { base: string; head: string }) => Promise<UnifiedDiff>) {}

  async agentExists(workspaceId: string, agentId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: t.agents.id }).from(t.agents)
      .where(and(eq(t.agents.id, agentId), eq(t.agents.workspaceId, workspaceId)));
    return !!row;
  }

  async source(workspaceId: string, findingId: string, fixtureId?: string): Promise<SourceFinding | undefined> {
    const [row] = await this.db.select({ finding: t.findings, review: t.reviews })
      .from(t.findings).innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
      .where(and(eq(t.findings.id, findingId), eq(t.reviews.workspaceId, workspaceId)));
    if (!row) return undefined;
    let fixture = fixtureId ? findFixture(fixtureId) : undefined;
    if (!fixtureId && row.review.runId && this.loadOriginal) {
      const [stored] = await this.db.select().from(t.evalReviewInputs).where(and(eq(t.evalReviewInputs.workspaceId, workspaceId), eq(t.evalReviewInputs.runId, row.review.runId)));
      const [pull] = await this.db.select().from(t.pullRequests).where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, row.review.prId)));
      const [repo] = pull ? await this.db.select().from(t.repos).where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, pull.repoId))) : [];
      const input = stored?.input as { diffHash?: unknown; revisions?: { base?: unknown; head?: unknown } } | undefined;
      const hash = input?.diffHash;
      const revisions = typeof input?.revisions?.base === 'string' && typeof input.revisions.head === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.revisions.base) && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.revisions.head) ? { base: input.revisions.base, head: input.revisions.head } : undefined;
      if (pull && repo && typeof hash === 'string' && (input?.revisions === undefined || revisions)) {
        try {
          const original = await this.loadOriginal(workspaceId, pull, repo, revisions);
          const anchor = { file: row.finding.file, startLine: row.finding.startLine, endLine: row.finding.endLine };
          const diff = originalFragment(original.raw, hash, anchor);
          if (diff && Buffer.byteLength(diff) <= 256 * 1024) fixture = { id: 'original-review', anchor, diff, metadata: { title: 'Original review', description: null } };
        } catch { /* original input is unavailable */ }
      }
    }
    return { id: row.finding.id, agentId: row.review.agentId, title: row.finding.title,
      anchor: { file: row.finding.file, startLine: row.finding.startLine, endLine: row.finding.endLine },
      accepted: row.finding.acceptedAt !== null, dismissed: row.finding.dismissedAt !== null,
      fixture: fixture ? { id: fixture.id, hash: fixture.id === 'original-review' ? createHash('sha256').update(fixture.diff).digest('hex') : fixtureHash(fixture), anchor: fixture.anchor, ...(fixture.id === 'original-review' ? { diff: fixture.diff } : {}) } : null };

  }

  async findByDecision(workspaceId: string, findingId: string, decision: 'accepted' | 'dismissed'): Promise<CaseRecord | undefined> {
    const [row] = await this.db.select({ source: t.evalCaseSources, evalCase: t.evalCases }).from(t.evalCaseSources)
      .innerJoin(t.evalCases, eq(t.evalCases.id, t.evalCaseSources.caseId))
      .where(and(eq(t.evalCaseSources.workspaceId, workspaceId), eq(t.evalCaseSources.findingId, findingId), eq(t.evalCaseSources.decision, decision)));
    if (row && !isPreparedSnapshot(row.source.snapshot)) throw new CaseConflict('fixture_changed');
    return row ? this.record(row.evalCase, row.source) : undefined;
  }

  async list(workspaceId: string, agentId: string): Promise<CaseRecord[]> {
    const rows = await this.db.select({ source: t.evalCaseSources, evalCase: t.evalCases }).from(t.evalCaseSources)
      .innerJoin(t.evalCases, eq(t.evalCases.id, t.evalCaseSources.caseId))
      .where(and(eq(t.evalCaseSources.workspaceId, workspaceId), eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.ownerKind, 'agent'), eq(t.evalCases.ownerId, agentId)))
      .orderBy(t.evalCases.id);
    return rows.filter((row) => isPreparedSnapshot(row.source.snapshot)).map((row) => this.record(row.evalCase, row.source));
  }

  async rename(workspaceId: string, agentId: string, caseId: string, name: string): Promise<boolean> {
    const rows = await this.db.update(t.evalCases).set({ name }).where(and(eq(t.evalCases.id, caseId), eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.ownerId, agentId), eq(t.evalCases.ownerKind, 'agent'))).returning({ id: t.evalCases.id });
    return rows.length > 0;
  }

  async saveManual(workspaceId: string, agentId: string, input: ManualCaseInput, caseId?: string): Promise<CaseRecord> {
    const name = input.name.trim();
    const { anchor, diff } = input;
    const hash = createHash('sha256').update(diff).digest('hex');
    if (!name || name.length > 200 || !anchor.file || anchor.file.length > 1024 || anchor.file.startsWith('/') || anchor.file.includes('\\') || anchor.file.split('/').includes('..') || !Number.isInteger(anchor.startLine) || !Number.isInteger(anchor.endLine) || anchor.startLine < 1 || anchor.endLine < anchor.startLine || Buffer.byteLength(diff) > 256 * 1024) throw new ManualCaseError('invalid_input');
    try { if (originalFragment(diff, hash, anchor) !== diff) throw new ManualCaseError('invalid_input'); } catch { throw new ManualCaseError('invalid_input'); }
    const snapshot: Omit<EvalCaseSnapshot, 'id'> = { expectation: input.expectation, anchor, fixtureId: 'manual', fixtureHash: hash, diff };
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${workspaceId}:${agentId}`}, 0))`);
      const [agent] = await tx.select({ id: t.agents.id }).from(t.agents).where(and(eq(t.agents.id, agentId), eq(t.agents.workspaceId, workspaceId)));
      if (!agent) throw new ManualCaseError('not_found');
      const rows = await tx.select({ source: t.evalCaseSources, evalCase: t.evalCases }).from(t.evalCaseSources).innerJoin(t.evalCases, eq(t.evalCases.id, t.evalCaseSources.caseId))
        .where(and(eq(t.evalCaseSources.workspaceId, workspaceId), eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.ownerId, agentId), eq(t.evalCases.ownerKind, 'agent')));
      const existing = caseId ? rows.find((row) => row.evalCase.id === caseId) : undefined;
      if (caseId && !existing) throw new ManualCaseError('not_found');
      const records = rows.filter((row) => row.evalCase.id !== caseId && isPreparedSnapshot(row.source.snapshot)).map((row) => this.record(row.evalCase, row.source));
      if (hasContradictoryLabels([...records, { ...snapshot, id: caseId ?? '' }])) throw new ManualCaseError('contradictory_labels');
      if (existing) {
        const [updated] = await tx.update(t.evalCases).set({ name, expectedOutput: { expectation: input.expectation, anchor } }).where(eq(t.evalCases.id, existing.evalCase.id)).returning();
        const [source] = await tx.update(t.evalCaseSources).set({ findingId: null, decision: input.expectation === 'must_find' ? 'accepted' : 'dismissed', snapshot }).where(eq(t.evalCaseSources.caseId, existing.evalCase.id)).returning();
        return this.record(updated!, source!);
      }
      const [created] = await tx.insert(t.evalCases).values({ workspaceId, ownerKind: 'agent', ownerId: agentId, name, expectedOutput: { expectation: input.expectation, anchor } }).returning();
      const [source] = await tx.insert(t.evalCaseSources).values({ workspaceId, findingId: null, decision: input.expectation === 'must_find' ? 'accepted' : 'dismissed', caseId: created!.id, snapshot }).returning();
      return this.record(created!, source!);
    });
  }

  async remove(workspaceId: string, agentId: string, caseId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${workspaceId}:${agentId}`}, 0))`);
      const rows = await tx.delete(t.evalCases).where(and(eq(t.evalCases.id, caseId), eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.ownerId, agentId), eq(t.evalCases.ownerKind, 'agent'))).returning({ id: t.evalCases.id });
      return rows.length > 0;
    });
  }

  async insert(workspaceId: string, source: SourceFinding, snapshot: Omit<EvalCaseSnapshot, 'id'>): Promise<{ created: boolean; value: CaseRecord }> {
    const agentId = source.agentId!;
    const decision = source.accepted ? 'accepted' : 'dismissed';
    return this.db.transaction(async (tx) => {
      // Serializes concurrent additions for this agent, including conflicting labels.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${workspaceId}:${agentId}`}, 0))`);
      const [agent] = await tx.select({ id: t.agents.id }).from(t.agents)
        .where(and(eq(t.agents.id, agentId), eq(t.agents.workspaceId, workspaceId)));
      if (!agent) throw new CaseConflict('decision_changed');
      const [current] = await tx.select({ acceptedAt: t.findings.acceptedAt, dismissedAt: t.findings.dismissedAt })
        .from(t.findings).innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
        .where(and(eq(t.findings.id, source.id), eq(t.reviews.workspaceId, workspaceId))).for('update');
      if (!current || (current.acceptedAt !== null) !== source.accepted || (current.dismissedAt !== null) !== source.dismissed) {
        throw new CaseConflict('decision_changed');
      }
      const rows = await tx.select({ source: t.evalCaseSources, evalCase: t.evalCases }).from(t.evalCaseSources)
        .innerJoin(t.evalCases, eq(t.evalCases.id, t.evalCaseSources.caseId))
        .where(and(eq(t.evalCaseSources.workspaceId, workspaceId), eq(t.evalCases.ownerId, agentId), eq(t.evalCases.ownerKind, 'agent')));
      const records = rows.filter((row) => isPreparedSnapshot(row.source.snapshot)).map((row) => this.record(row.evalCase, row.source));
      const existing = records.find((record) => record.findingId === source.id && record.expectation === snapshot.expectation);
      if (existing) {
        if (existing.fixtureId !== snapshot.fixtureId || existing.fixtureHash !== snapshot.fixtureHash) throw new CaseConflict('fixture_changed');
        return { created: false, value: existing };
      }
      if (hasContradictoryLabels([...records, { ...snapshot, id: '' }])) throw new CaseConflict('contradictory_labels');
      const [evalCase] = await tx.insert(t.evalCases).values({ workspaceId, ownerKind: 'agent', ownerId: agentId, name: source.title, expectedOutput: { expectation: snapshot.expectation, anchor: snapshot.anchor } }).returning();
      const [caseSource] = await tx.insert(t.evalCaseSources).values({ workspaceId, findingId: source.id, decision, caseId: evalCase!.id, snapshot }).returning();
      return { created: true, value: this.record(evalCase!, caseSource!) };
    });
  }

  private record(row: typeof t.evalCases.$inferSelect, source: typeof t.evalCaseSources.$inferSelect): CaseRecord {
    return { ...(source.snapshot as Omit<EvalCaseSnapshot, 'id'>), id: row.id, agentId: row.ownerId, findingId: source.findingId, name: row.name };
  }
}

function isPreparedSnapshot(snapshot: unknown): snapshot is Omit<EvalCaseSnapshot, 'id'> {
  return typeof snapshot === 'object' && snapshot !== null && 'fixtureId' in snapshot && typeof snapshot.fixtureId === 'string'
    && 'fixtureHash' in snapshot && typeof snapshot.fixtureHash === 'string';
}
