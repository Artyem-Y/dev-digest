import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export interface BlastPullSnapshot {
  repoId: string;
  changedFiles: string[];
}

/** Drizzle adapter for the persisted PR snapshot used by Blast Radius. */
export class BlastRepository {
  constructor(private readonly db: Db) {}

  async findPullSnapshot(workspaceId: string, pullId: string): Promise<BlastPullSnapshot | undefined> {
    const [pull] = await this.db
      .select({ id: t.pullRequests.id, repoId: t.pullRequests.repoId })
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, pullId)));
    if (!pull) return undefined;

    const files = await this.db
      .select({ path: t.prFiles.path })
      .from(t.prFiles)
      .where(eq(t.prFiles.prId, pull.id));
    return { repoId: pull.repoId, changedFiles: files.map((file) => file.path) };
  }
}
