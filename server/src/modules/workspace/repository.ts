import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export interface WorkspaceRepoRow {
  id: string;
  fullName: string;
  clonePath: string | null;
  lastPolledAt: Date | null;
}

export interface WorkspaceRepositoryPort { list(workspaceId: string): Promise<WorkspaceRepoRow[]>; }

/** Drizzle adapter for the workspace's repository summary. */
export class WorkspaceRepository implements WorkspaceRepositoryPort {
  constructor(private readonly db: Db) {}

  async list(workspaceId: string): Promise<WorkspaceRepoRow[]> {
    return this.db.select({
      id: t.repos.id,
      fullName: t.repos.fullName,
      clonePath: t.repos.clonePath,
      lastPolledAt: t.repos.lastPolledAt,
    }).from(t.repos).where(eq(t.repos.workspaceId, workspaceId));
  }
}
