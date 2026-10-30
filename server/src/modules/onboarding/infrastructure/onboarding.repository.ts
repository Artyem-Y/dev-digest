import { and, desc, eq, gt, lte, sql } from 'drizzle-orm';
import { OnboardingTour } from '../../../vendor/shared/contracts/onboarding-tour.js';
import type { Db } from '../../../db/client.js';
import { onboarding, onboardingAttempts, repos } from '../../../db/schema.js';

const emptyUsage = { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: null };
type Terminal = 'generated' | 'partial' | 'failed' | 'cancelled';

export class OnboardingRepository {
  constructor(private readonly db: Db) {}

  async get(workspaceId: string, repoId: string) {
    const [repo] = await this.db.select({ id: repos.id }).from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.workspaceId, workspaceId)));
    if (!repo) return null;
    const [tour] = await this.db.select().from(onboarding).where(eq(onboarding.repoId, repoId));
    const [attempt] = await this.db.select().from(onboardingAttempts)
      .where(eq(onboardingAttempts.repoId, repoId)).orderBy(desc(onboardingAttempts.createdAt), desc(onboardingAttempts.id)).limit(1);
    return { tour: tour ?? null, attempt: attempt ?? null };
  }

  async admit(workspaceId: string, repoId: string, leaseMs: number) {
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error('Invalid lease duration');
    return this.db.transaction(async (tx) => {
      const [repo] = await tx.select({ id: repos.id }).from(repos)
        .where(and(eq(repos.id, repoId), eq(repos.workspaceId, workspaceId))).for('update');
      if (!repo) return null;
      await tx.update(onboardingAttempts).set({ status: 'failed', reason: 'timeout', finishedAt: new Date() })
        .where(and(eq(onboardingAttempts.repoId, repoId), eq(onboardingAttempts.status, 'pending'), lte(onboardingAttempts.leaseUntil, new Date())));
      const [attempt] = await tx.insert(onboardingAttempts).values({ repoId, status: 'pending', usage: emptyUsage, leaseUntil: new Date(Date.now() + leaseMs) })
        .onConflictDoNothing().returning();
      return attempt ?? null;
    });
  }

  async expireAbandoned() {
    const rows = await this.db.update(onboardingAttempts).set({ status: 'failed', reason: 'timeout', finishedAt: new Date() })
      .where(and(eq(onboardingAttempts.status, 'pending'), lte(onboardingAttempts.leaseUntil, new Date())))
      .returning({ id: onboardingAttempts.id });
    return rows.length;
  }

  async expire(workspaceId: string, repoId: string, now = new Date()) {
    const rows = await this.db.update(onboardingAttempts).set({ status: 'failed', reason: 'timeout', finishedAt: now })
      .where(and(eq(onboardingAttempts.repoId, repoId), eq(onboardingAttempts.status, 'pending'), lte(onboardingAttempts.leaseUntil, now),
        sql`exists (select 1 from ${repos} where ${repos.id} = ${onboardingAttempts.repoId} and ${repos.workspaceId} = ${workspaceId})`)).returning({ id: onboardingAttempts.id });
    return rows.length > 0;
  }

  async finish(workspaceId: string, repoId: string, id: string, token: string, status: Terminal, result: unknown | null, reason: string | null, usage: unknown = emptyUsage) {
    if ((status === 'generated' || status === 'partial') !== (result !== null)) throw new Error('Invalid terminal result');
    return this.db.transaction(async (tx) => {
      const [attempt] = await tx.update(onboardingAttempts).set({ status, reason, usage, finishedAt: new Date() })
        .where(and(eq(onboardingAttempts.id, id), eq(onboardingAttempts.repoId, repoId), eq(onboardingAttempts.token, token),
          eq(onboardingAttempts.status, 'pending'), gt(onboardingAttempts.leaseUntil, new Date()),
          sql`exists (select 1 from ${repos} where ${repos.id} = ${onboardingAttempts.repoId} and ${repos.workspaceId} = ${workspaceId})`)).returning({ id: onboardingAttempts.id });
      if (!attempt) return false;
      if (result !== null) {
        const tour = OnboardingTour.parse(result);
        if (tour.repo_id !== repoId) throw new Error('Tour repository mismatch');
        const values = { json: tour, sourceRevision: tour.source_revision, indexRevision: tour.index_revision, generatedAt: new Date(tour.generated_at) };
        await tx.insert(onboarding).values({ repoId, ...values })
          .onConflictDoUpdate({ target: onboarding.repoId, set: values });
      }
      return true;
    });
  }
}
