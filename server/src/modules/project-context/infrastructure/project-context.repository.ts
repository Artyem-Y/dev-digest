import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { ProjectContextAttachment } from '../domain/types.js';
import type { ProjectContextRepository } from '../application/ports.js';

export class DrizzleProjectContextRepository implements ProjectContextRepository {
  constructor(private readonly db: Db) {}

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
        .where(and(eq(t.agentProjectDocuments.workspaceId, input.workspaceId), eq(t.agentProjectDocuments.repoId, input.repoId), eq(t.agentProjectDocuments.agentId, input.ownerId), eq(t.agents.workspaceId, input.workspaceId)));
      return rows.map((row) => row.path).sort((a, b) => a.localeCompare(b));
    }
    const rows = await this.db.select({ path: t.skillProjectDocuments.path }).from(t.skillProjectDocuments)
      .innerJoin(t.skills, eq(t.skillProjectDocuments.skillId, t.skills.id))
      .where(and(eq(t.skillProjectDocuments.workspaceId, input.workspaceId), eq(t.skillProjectDocuments.repoId, input.repoId), eq(t.skillProjectDocuments.skillId, input.ownerId), eq(t.skills.workspaceId, input.workspaceId)));
    return rows.map((row) => row.path).sort((a, b) => a.localeCompare(b));
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
