import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { ProjectContextAttachment } from '../domain/types.js';
import type { ProjectContextRepository } from '../application/ports.js';
import { isUnsafeSkillContent } from '../../../vendor/shared/skill-safety.js';

export class DrizzleProjectContextRepository implements ProjectContextRepository {
  constructor(private readonly db: Db) {}

  async listForAgent(workspaceId: string, repoId: string, agentId: string): Promise<ProjectContextAttachment[]> {
    const [direct, inherited] = await Promise.all([
      this.db.select({ path: t.agentProjectDocuments.path }).from(t.agentProjectDocuments)
        .innerJoin(t.agents, eq(t.agentProjectDocuments.agentId, t.agents.id))
        .where(and(eq(t.agentProjectDocuments.workspaceId, workspaceId), eq(t.agentProjectDocuments.repoId, repoId), eq(t.agentProjectDocuments.agentId, agentId), eq(t.agents.workspaceId, workspaceId)))
        .orderBy(asc(t.agentProjectDocuments.order), asc(t.agentProjectDocuments.path)),
      this.db.select({ path: t.skillProjectDocuments.path, skillId: t.skills.id, body: t.skills.body })
        .from(t.skillProjectDocuments)
        .innerJoin(t.skills, eq(t.skillProjectDocuments.skillId, t.skills.id))
        .innerJoin(t.agentSkills, eq(t.agentSkills.skillId, t.skills.id))
        .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
        .where(and(eq(t.skillProjectDocuments.workspaceId, workspaceId), eq(t.skillProjectDocuments.repoId, repoId), eq(t.agentSkills.agentId, agentId), eq(t.agentSkills.enabled, true), eq(t.skills.workspaceId, workspaceId), eq(t.skills.enabled, true), eq(t.agents.workspaceId, workspaceId)))
        .orderBy(asc(t.agentSkills.order), asc(t.skillProjectDocuments.order), asc(t.skillProjectDocuments.path)),
    ]);
    return [
      ...direct.map(({ path }) => ({ path, provenance: 'direct_agent' as const })),
      ...inherited.filter(({ body }) => !isUnsafeSkillContent(body)).map(({ path, skillId }) => ({ path, skillId, provenance: 'linked_skill' as const })),
    ];
  }

  async listForBrief(workspaceId: string, repoId: string): Promise<ProjectContextAttachment[]> {
    const [direct, inherited] = await Promise.all([
      this.db.select({ path: t.agentProjectDocuments.path })
        .from(t.agentProjectDocuments)
        .innerJoin(t.agents, eq(t.agentProjectDocuments.agentId, t.agents.id))
        .where(and(
          eq(t.agentProjectDocuments.workspaceId, workspaceId), eq(t.agentProjectDocuments.repoId, repoId),
          eq(t.agents.workspaceId, workspaceId), eq(t.agents.enabled, true),
        )),
      this.db.select({ path: t.skillProjectDocuments.path, skillId: t.skillProjectDocuments.skillId })
        .from(t.skillProjectDocuments)
        .innerJoin(t.skills, eq(t.skillProjectDocuments.skillId, t.skills.id))
        .innerJoin(t.agentSkills, eq(t.agentSkills.skillId, t.skills.id))
        .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
        .where(and(
          eq(t.skillProjectDocuments.workspaceId, workspaceId), eq(t.skillProjectDocuments.repoId, repoId),
          eq(t.skills.workspaceId, workspaceId), eq(t.skills.enabled, true),
          eq(t.agents.workspaceId, workspaceId), eq(t.agents.enabled, true), eq(t.agentSkills.enabled, true),
        )),
    ]);
    return [
      ...direct.map((row) => ({ path: row.path, provenance: 'direct_agent' as const })),
      ...inherited.map((row) => ({ path: row.path, provenance: 'linked_skill' as const, skillId: row.skillId })),
    ];
  }

  async clonePath(workspaceId: string, repoId: string): Promise<string | null> {
    const [row] = await this.db.select({ clonePath: t.repos.clonePath }).from(t.repos)
      .where(and(eq(t.repos.id, repoId), eq(t.repos.workspaceId, workspaceId)));
    return row?.clonePath ?? null;
  }

  async listOwnerAttachments(input: { workspaceId: string; repoId: string; owner: 'agent' | 'skill'; ownerId: string }): Promise<string[]> {
    if (input.owner === 'agent') {
      const rows = await this.db.select({ path: t.agentProjectDocuments.path }).from(t.agentProjectDocuments)
        .innerJoin(t.agents, eq(t.agentProjectDocuments.agentId, t.agents.id))
        .where(and(eq(t.agentProjectDocuments.workspaceId, input.workspaceId), eq(t.agentProjectDocuments.repoId, input.repoId), eq(t.agentProjectDocuments.agentId, input.ownerId), eq(t.agents.workspaceId, input.workspaceId)))
        .orderBy(asc(t.agentProjectDocuments.order), asc(t.agentProjectDocuments.path));
      return rows.map((row) => row.path);
    }
    const rows = await this.db.select({ path: t.skillProjectDocuments.path }).from(t.skillProjectDocuments)
      .innerJoin(t.skills, eq(t.skillProjectDocuments.skillId, t.skills.id))
      .where(and(eq(t.skillProjectDocuments.workspaceId, input.workspaceId), eq(t.skillProjectDocuments.repoId, input.repoId), eq(t.skillProjectDocuments.skillId, input.ownerId), eq(t.skills.workspaceId, input.workspaceId)))
      .orderBy(asc(t.skillProjectDocuments.order), asc(t.skillProjectDocuments.path));
    return rows.map((row) => row.path);
  }

  async reorder(input: { workspaceId: string; repoId: string; owner: 'agent' | 'skill'; ownerId: string; paths: string[] }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const table = input.owner === 'agent' ? t.agentProjectDocuments : t.skillProjectDocuments;
      const ownerColumn = input.owner === 'agent' ? t.agentProjectDocuments.agentId : t.skillProjectDocuments.skillId;
      const scope = and(eq(table.workspaceId, input.workspaceId), eq(table.repoId, input.repoId), eq(ownerColumn, input.ownerId));
      const rows = await tx.select({ path: table.path }).from(table).where(scope).for('update');
      const existing = new Set(rows.map((row) => row.path));
      if (existing.size !== input.paths.length || new Set(input.paths).size !== input.paths.length || input.paths.some((path) => !existing.has(path))) {
        throw new Error('Attachment list changed; reload before reordering');
      }
      for (const [order, path] of input.paths.entries()) {
        await tx.update(table).set({ order }).where(and(scope, eq(table.path, path)));
      }
    });
  }

  async attach(input: { workspaceId: string; repoId: string; owner: 'agent' | 'skill'; ownerId: string; path: string }): Promise<void> {
    const [repo] = await this.db.select({ id: t.repos.id }).from(t.repos)
      .where(and(eq(t.repos.id, input.repoId), eq(t.repos.workspaceId, input.workspaceId)));
    if (!repo) throw new Error('Project Context repository is outside the workspace');
    if (input.owner === 'agent') {
      const [agent] = await this.db.select({ id: t.agents.id }).from(t.agents)
        .where(and(eq(t.agents.id, input.ownerId), eq(t.agents.workspaceId, input.workspaceId)));
      if (!agent) throw new Error('Project Context agent is outside the workspace');
      await this.db.insert(t.agentProjectDocuments).values({ workspaceId: input.workspaceId, repoId: input.repoId, agentId: input.ownerId, path: input.path }).onConflictDoNothing();
      return;
    }
    const [skill] = await this.db.select({ id: t.skills.id }).from(t.skills)
      .where(and(eq(t.skills.id, input.ownerId), eq(t.skills.workspaceId, input.workspaceId)));
    if (!skill) throw new Error('Project Context skill is outside the workspace');
    await this.db.insert(t.skillProjectDocuments).values({ workspaceId: input.workspaceId, repoId: input.repoId, skillId: input.ownerId, path: input.path }).onConflictDoNothing();
  }

  async detach(input: { workspaceId: string; repoId: string; owner: 'agent' | 'skill'; ownerId: string; path: string }): Promise<void> {
    if (input.owner === 'agent') {
      await this.db.delete(t.agentProjectDocuments).where(and(eq(t.agentProjectDocuments.workspaceId, input.workspaceId), eq(t.agentProjectDocuments.repoId, input.repoId), eq(t.agentProjectDocuments.agentId, input.ownerId), eq(t.agentProjectDocuments.path, input.path)));
      return;
    }
    await this.db.delete(t.skillProjectDocuments).where(and(eq(t.skillProjectDocuments.workspaceId, input.workspaceId), eq(t.skillProjectDocuments.repoId, input.repoId), eq(t.skillProjectDocuments.skillId, input.ownerId), eq(t.skillProjectDocuments.path, input.path)));
  }
}
