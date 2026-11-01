import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { CiFailOn, Provider, ReviewStrategy } from '@devdigest/shared';
import { DEFAULT_AGENT_DESCRIPTION, INITIAL_AGENT_VERSION } from './constants.js';
import { isConfigChange } from './helpers.js';

/**
 * A2 — agents data-access. Owns `agents`, `agent_versions`, and the
 * `agent_skills` link table (shared with A1's skills repository, but A2 owns the
 * agent side: link/reorder/list for an agent). Workspace-scoped throughout.
 */

import type { AgentRow, AgentVersionRow } from '../../db/rows.js';
export type { AgentRow, AgentVersionRow };

export interface InsertAgent {
  workspaceId: string;
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
  createdBy?: string | null;
}

export interface UpdateAgent {
  name?: string;
  description?: string;
  provider?: Provider;
  model?: string;
  systemPrompt?: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
}

/** Prompt-safe fields selected for the local MCP read boundary. */
export interface McpAgentSummaryRow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  provider: string;
  model: string;
  version: number;
}

/** A skill linked to an agent (with its order), joined from agent_skills. */
export interface LinkedSkillRow {
  skill: typeof t.skills.$inferSelect;
  order: number;
  enabled: boolean;
}

export class AgentsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<AgentRow[]> {
    return this.db.select().from(t.agents).where(eq(t.agents.workspaceId, workspaceId));
  }

  /** Select only fields permitted to cross the local MCP boundary. */
  async listMcpSummaries(workspaceId: string): Promise<McpAgentSummaryRow[]> {
    return this.db
      .select({
        id: t.agents.id,
        name: t.agents.name,
        description: t.agents.description,
        enabled: t.agents.enabled,
        provider: t.agents.provider,
        model: t.agents.model,
        version: t.agents.version,
      })
      .from(t.agents)
      .where(eq(t.agents.workspaceId, workspaceId));
  }

  async listEnabled(workspaceId: string): Promise<AgentRow[]> {
    return this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.enabled, true)));
  }

  async getById(workspaceId: string, id: string): Promise<AgentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)));
    return row;
  }

  async getByIds(workspaceId: string, ids: string[]): Promise<AgentRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), inArray(t.agents.id, ids)));
  }

  /** Delete an agent (scoped to workspace). Versions/skill-links cascade;
   *  agent_runs keep their history with agent_id set null. Returns false if
   *  no such agent existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
      .returning({ id: t.agents.id });
    return rows.length > 0;
  }

  /** Insert an agent AND record version 1 in agent_versions (immutable snapshot). */
  async insert(values: InsertAgent): Promise<AgentRow> {
    const [row] = await this.db
      .insert(t.agents)
      .values({
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description ?? DEFAULT_AGENT_DESCRIPTION,
        provider: values.provider,
        model: values.model,
        systemPrompt: values.systemPrompt,
        outputSchema: (values.outputSchema as object | undefined) ?? null,
        ...(values.strategy !== undefined ? { strategy: values.strategy } : {}),
        ...(values.ciFailOn !== undefined ? { ciFailOn: values.ciFailOn } : {}),
        ...(values.repoIntel !== undefined ? { repoIntel: values.repoIntel } : {}),
        enabled: values.enabled ?? true,
        version: INITIAL_AGENT_VERSION,
        createdBy: values.createdBy ?? null,
      })
      .returning();
    await this.snapshotVersion(row!, INITIAL_AGENT_VERSION);
    return row!;
  }

  /**
   * Update an agent. Any config change bumps the version and snapshots the new
   * config into agent_versions (reproducibility for eval).
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateAgent,
  ): Promise<AgentRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(t.agents)
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id))).for('update');
      if (!existing) return undefined;
      const configChanged = isConfigChange(existing, patch);
      const nextVersion = configChanged ? existing.version + 1 : existing.version;
      const [row] = await tx
        .update(t.agents)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
          ...(patch.model !== undefined ? { model: patch.model } : {}),
          ...(patch.systemPrompt !== undefined ? { systemPrompt: patch.systemPrompt } : {}),
          ...(patch.outputSchema !== undefined
            ? { outputSchema: patch.outputSchema as object }
            : {}),
          ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
          ...(patch.ciFailOn !== undefined ? { ciFailOn: patch.ciFailOn } : {}),
          ...(patch.repoIntel !== undefined ? { repoIntel: patch.repoIntel } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(configChanged ? { version: nextVersion } : {}),
        })
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
        .returning();

      if (configChanged && row) {
        const links = await tx.select({ id: t.agentSkills.skillId }).from(t.agentSkills)
          .where(eq(t.agentSkills.agentId, id)).orderBy(asc(t.agentSkills.order));
        await tx.insert(t.agentVersions).values({ agentId: row.id, version: nextVersion, configJson: {
          provider: row.provider, model: row.model, system_prompt: row.systemPrompt, output_schema: row.outputSchema,
          strategy: row.strategy, ci_fail_on: row.ciFailOn, repo_intel: row.repoIntel, skills: links.map((link) => link.id),
        } });
      }
      return row;
    });
  }

  private async snapshotVersion(row: AgentRow, version: number): Promise<void> {
    const skills = await this.skillIdsForAgent(row.id);
    await this.db
      .insert(t.agentVersions)
      .values({
        agentId: row.id,
        version,
        configJson: {
          provider: row.provider,
          model: row.model,
          system_prompt: row.systemPrompt,
          output_schema: row.outputSchema,
          strategy: row.strategy,
          ci_fail_on: row.ciFailOn,
          repo_intel: row.repoIntel,
          skills,
        },
      })
      .onConflictDoNothing();
  }

  // ---- agent_versions (immutable config snapshots) ------------------------

  /** All config snapshots for an agent, newest version first. */
  async listVersions(agentId: string): Promise<AgentVersionRow[]> {
    return this.db
      .select()
      .from(t.agentVersions)
      .where(eq(t.agentVersions.agentId, agentId))
      .orderBy(desc(t.agentVersions.version));
  }

  /** A single config snapshot, or undefined if that version was never recorded. */
  async getVersion(agentId: string, version: number): Promise<AgentVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agentVersions)
      .where(and(eq(t.agentVersions.agentId, agentId), eq(t.agentVersions.version, version)));
    return row;
  }

  // ---- agent_skills link table (A2 owns the agent side) -------------------

  /** Skills linked to an agent, in `order` ascending. */
  async linkedSkills(agentId: string): Promise<LinkedSkillRow[]> {
    const rows = await this.db
      .select({ skill: t.skills, order: t.agentSkills.order, enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agentSkills.agentId, agentId))
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => ({ skill: r.skill, order: r.order, enabled: r.enabled }));
  }

  async skillIdsForAgent(agentId: string): Promise<string[]> {
    const links = await this.linkedSkills(agentId);
    return links.map((l) => l.skill.id);
  }

  /** Serialize skill link changes with agent configuration updates and promotion. */
  async changeSkills(workspaceId: string, agentId: string, change: { kind: 'set'; ids: string[] } | { kind: 'link'; id: string; order?: number } | { kind: 'enabled'; id: string; enabled: boolean }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [agent] = await tx.select().from(t.agents).where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, agentId))).for('update');
      if (!agent) return false;
      if (change.kind === 'set') {
        const old = await tx.select({ id: t.agentSkills.skillId, enabled: t.agentSkills.enabled }).from(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
        const enabled = new Map(old.map((link) => [link.id, link.enabled]));
        await tx.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
        if (change.ids.length) await tx.insert(t.agentSkills).values(change.ids.map((id, order) => ({ agentId, skillId: id, order, enabled: enabled.get(id) ?? true })));
      } else if (change.kind === 'link') {
        const current = await tx.select({ id: t.agentSkills.skillId }).from(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
        const order = change.order ?? current.length;
        await tx.insert(t.agentSkills).values({ agentId, skillId: change.id, order, enabled: true }).onConflictDoUpdate({ target: [t.agentSkills.agentId, t.agentSkills.skillId], set: { order } });
      } else {
        await tx.update(t.agentSkills).set({ enabled: change.enabled }).where(and(eq(t.agentSkills.agentId, agentId), eq(t.agentSkills.skillId, change.id)));
      }
      const links = await tx.select({ id: t.agentSkills.skillId }).from(t.agentSkills).where(eq(t.agentSkills.agentId, agentId)).orderBy(asc(t.agentSkills.order));
      const version = agent.version + 1;
      await tx.update(t.agents).set({ version }).where(eq(t.agents.id, agentId));
      await tx.insert(t.agentVersions).values({ agentId, version, configJson: { provider: agent.provider, model: agent.model, system_prompt: agent.systemPrompt, output_schema: agent.outputSchema, strategy: agent.strategy, ci_fail_on: agent.ciFailOn, repo_intel: agent.repoIntel, skills: links.map((link) => link.id) } });
      return true;
    });
  }

  async skillsBelongToWorkspace(workspaceId: string, skillIds: string[]): Promise<boolean> {
    if (skillIds.length === 0) return true;
    const rows = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, skillIds)));
    return rows.length === skillIds.length;
  }

}
