import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export class ConventionsRepository {
  constructor(private readonly db: Db) {}

  list(workspaceId: string, repoId: string) {
    return this.db.select().from(t.conventions).where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }

  async replace(
    workspaceId: string,
    repoId: string,
    rows: Array<Pick<typeof t.conventions.$inferInsert, 'category' | 'rule' | 'evidencePath' | 'evidenceLine' | 'evidenceSnippet' | 'confidence'>>,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.delete(t.conventions).where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
      if (rows.length === 0) return [];
      return tx.insert(t.conventions).values(rows.map((row) => ({
        ...row,
        workspaceId,
        repoId,
        status: 'pending' as const,
        accepted: false,
      }))).returning();
    });
  }

  async setStatus(workspaceId: string, repoId: string, id: string, status: 'pending' | 'accepted' | 'rejected', rule?: string) {
    const [row] = await this.db.update(t.conventions).set({
      status,
      accepted: status === 'accepted',
      ...(rule === undefined ? {} : { editedRule: rule }),
    }).where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId), eq(t.conventions.id, id))).returning();
    return row;
  }
}
