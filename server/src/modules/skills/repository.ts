import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export class SkillsRepository {
  constructor(private readonly db: Db) {}

  list(workspaceId: string) {
    return this.db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId)).orderBy(asc(t.skills.name));
  }

  async get(workspaceId: string, id: string) {
    const [row] = await this.db.select().from(t.skills).where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  async create(input: typeof t.skills.$inferInsert) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(t.skills).values(input).returning();
      await tx.insert(t.skillVersions).values({ skillId: row!.id, version: 1, body: row!.body });
      return row!;
    });
  }

  async update(workspaceId: string, id: string, expectedVersion: number, input: Pick<typeof t.skills.$inferInsert, 'name' | 'description' | 'type' | 'body' | 'enabled'>) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(t.skills).where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
      if (!existing) return { kind: 'missing' as const };
      const bodyChanged = existing.body !== input.body;
      const nextVersion = bodyChanged ? existing.version + 1 : existing.version;
      const [row] = await tx.update(t.skills).set({ ...input, version: nextVersion }).where(and(eq(t.skills.id, id), eq(t.skills.version, expectedVersion))).returning();
      if (!row) return { kind: 'conflict' as const };
      if (bodyChanged) await tx.insert(t.skillVersions).values({ skillId: id, version: nextVersion, body: input.body });
      return { kind: 'ok' as const, row };
    });
  }

  async linkedAgentCount(workspaceId: string, id: string) {
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(and(eq(t.agentSkills.skillId, id), eq(t.agents.workspaceId, workspaceId)));
    return Number(row?.count ?? 0);
  }

  async linkedAgents(workspaceId: string, id: string) {
    return this.db.select({ id: t.agents.id, name: t.agents.name }).from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(and(eq(t.agentSkills.skillId, id), eq(t.agents.workspaceId, workspaceId)))
      .orderBy(asc(t.agents.name));
  }

  async listVersions(workspaceId: string, id: string) {
    const skill = await this.get(workspaceId, id);
    if (!skill) return undefined;
    return this.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, id)).orderBy(sql`${t.skillVersions.version} desc`);
  }

  async getVersion(workspaceId: string, id: string, version: number) {
    if (!(await this.get(workspaceId, id))) return undefined;
    const [row] = await this.db.select().from(t.skillVersions).where(and(eq(t.skillVersions.skillId, id), eq(t.skillVersions.version, version)));
    return row;
  }

  async deleteVersion(workspaceId: string, id: string, version: number) {
    if (!(await this.get(workspaceId, id))) return false;
    const rows = await this.db.delete(t.skillVersions).where(and(eq(t.skillVersions.skillId, id), eq(t.skillVersions.version, version))).returning({ version: t.skillVersions.version });
    return rows.length > 0;
  }

  async delete(workspaceId: string, id: string) {
    const rows = await this.db.delete(t.skills).where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id))).returning({ id: t.skills.id });
    return rows.length > 0;
  }
}
