import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import { DerivedIntent, type Intent } from '@devdigest/shared';
import type { PullRow } from '../../../db/rows.js';

// ---- PR lookup (workspace-scoped) -----------------------------------------

export async function getPull(
  db: Db,
  workspaceId: string,
  prId: string,
): Promise<PullRow | undefined> {
  const [row] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
  return row;
}

export async function getRepo(
  db: Db,
  repoId: string,
): Promise<typeof t.repos.$inferSelect | undefined> {
  const [row] = await db.select().from(t.repos).where(eq(t.repos.id, repoId));
  return row;
}

export async function getPrFiles(
  db: Db,
  prId: string,
): Promise<(typeof t.prFiles.$inferSelect)[]> {
  return db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
}

/**
 * Record the commit a review just ran against, so the PR list can derive
 * `reviewed` vs `needs_review` (head moved since the last review) vs `stale`.
 */
export async function markReviewed(db: Db, prId: string, sha: string): Promise<void> {
  await db
    .update(t.pullRequests)
    .set({ lastReviewedSha: sha })
    .where(eq(t.pullRequests.id, prId));
}

// ---- intent ---------------------------------------------------------------

export async function upsertIntent(db: Db, prId: string, intent: Intent): Promise<void> {
  await db
    .insert(t.prIntent)
    .values({
      prId,
      intent: intent.intent,
      inScope: intent.in_scope,
      outOfScope: intent.out_of_scope,
    })
    .onConflictDoUpdate({
      target: t.prIntent.prId,
      set: { intent: intent.intent, inScope: intent.in_scope, outOfScope: intent.out_of_scope },
    });
}

export async function getIntent(db: Db, prId: string): Promise<Intent | undefined> {
  const [row] = await db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
  if (!row) return undefined;
  return { intent: row.intent, in_scope: row.inScope, out_of_scope: row.outOfScope };
}

export async function getDerivedIntent(db: Db, prId: string): Promise<DerivedIntent | undefined> {
  const [row] = await db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
  if (!row || !row.confidence || !row.evidence || !row.sourceFingerprint || !row.modelProvider || !row.model || !row.derivedAt) return undefined;
  const parsed = DerivedIntent.safeParse({
    intent: row.intent,
    in_scope: row.inScope,
    out_of_scope: row.outOfScope,
    confidence: row.confidence,
    evidence: row.evidence,
    source_fingerprint: row.sourceFingerprint,
    model_provider: row.modelProvider,
    model: row.model,
    derived_at: row.derivedAt.toISOString(),
  });
  return parsed.success ? parsed.data : undefined;
}

/** A transient classifier failure never reaches this method, preserving the last valid intent. */
export async function upsertDerivedIntent(db: Db, prId: string, intent: DerivedIntent): Promise<void> {
  await db.insert(t.prIntent).values({
    prId,
    intent: intent.intent,
    inScope: intent.in_scope,
    outOfScope: intent.out_of_scope,
    confidence: intent.confidence,
    evidence: intent.evidence,
    sourceFingerprint: intent.source_fingerprint,
    modelProvider: intent.model_provider,
    model: intent.model,
    derivedAt: new Date(intent.derived_at),
  }).onConflictDoUpdate({
    target: t.prIntent.prId,
    set: {
      intent: intent.intent, inScope: intent.in_scope, outOfScope: intent.out_of_scope,
      confidence: intent.confidence, evidence: intent.evidence, sourceFingerprint: intent.source_fingerprint,
      modelProvider: intent.model_provider, model: intent.model, derivedAt: new Date(intent.derived_at),
    },
  });
}
