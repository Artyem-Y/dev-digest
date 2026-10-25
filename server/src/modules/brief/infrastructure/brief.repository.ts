import { and, eq } from 'drizzle-orm';
import { Brief, BriefSourceStatus, StoredPrBrief } from '@devdigest/shared';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import { buildSmartDiff } from '../../reviews/smart-diff/domain/build-smart-diff.js';
import type { BriefCacheRecord, BriefPullSnapshot } from '../domain/types.js';
import type { BriefReadPort } from '../application/ports.js';

/** Tenant-scoped persistence adapter. It never reads pr_files.patch. */
export class DrizzleBriefRepository implements BriefReadPort {
  constructor(private readonly db: Db) {}

  async getSnapshot(workspaceId: string, prId: string): Promise<BriefPullSnapshot | undefined> {
    const [pull] = await this.db.select().from(t.pullRequests).where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    if (!pull) return undefined;
    const [files, intentRows] = await Promise.all([
      this.db.select({ path: t.prFiles.path, additions: t.prFiles.additions, deletions: t.prFiles.deletions }).from(t.prFiles).where(eq(t.prFiles.prId, prId)),
      this.db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId)),
    ]);
    const intent = intentRows[0];
    return {
      id: pull.id, repoId: pull.repoId, headSha: pull.headSha, title: pull.title, body: pull.body, number: pull.number,
      additions: pull.additions, deletions: pull.deletions, files,
      intent: intent ? { intent: intent.intent, in_scope: intent.inScope, out_of_scope: intent.outOfScope } : undefined,
      smartDiff: buildSmartDiff(files, []),
    };
  }

  async getCache(workspaceId: string, prId: string): Promise<BriefCacheRecord | undefined> {
    const [row] = await this.db.select({ json: t.prBrief.json, sources: t.prBrief.sources }).from(t.prBrief)
      .innerJoin(t.pullRequests, eq(t.pullRequests.id, t.prBrief.prId))
      .where(and(eq(t.prBrief.prId, prId), eq(t.pullRequests.workspaceId, workspaceId)));
    if (!row) return undefined;
    // Legacy cache data remains readable for migration compatibility, but never
    // masquerades as current transport; regeneration replaces it with Brief.
    const current = Brief.safeParse(row.json);
    if (!current.success) { StoredPrBrief.safeParse(row.json); return undefined; }
    const sources = Array.isArray(row.sources) ? row.sources.map((source) => BriefSourceStatus.safeParse(source)).filter((result) => result.success).map((result) => result.data) : [];
    return { brief: current.data, sources };
  }

  async replace(workspaceId: string, prId: string, record: BriefCacheRecord): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: t.pullRequests.id }).from(t.pullRequests)
        .where(and(eq(t.pullRequests.id, prId), eq(t.pullRequests.workspaceId, workspaceId)));
      if (!owned) throw new Error('Brief cache replacement outside workspace');
      await tx.insert(t.prBrief).values({ prId, json: record.brief, headSha: record.brief.head_sha, sources: record.sources, telemetry: record.telemetry })
        .onConflictDoUpdate({ target: t.prBrief.prId, set: { json: record.brief, headSha: record.brief.head_sha, sources: record.sources, telemetry: record.telemetry } });
    });
  }
}
