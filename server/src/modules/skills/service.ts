import type { Skill, SkillType, SkillVersion } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import { AppError, NotFoundError } from '../../platform/errors.js';

function dto(row: Awaited<ReturnType<SkillsRepository['get']>> & {}, agentCount = 0) : Skill {
  return {
    id: row!.id,
    name: row!.name,
    description: row!.description,
    type: row!.type as SkillType,
    source: row!.source as Skill['source'],
    body: row!.body,
    enabled: row!.enabled,
    version: row!.version,
    agent_count: agentCount,
    evidence_files: row!.evidenceFiles ?? null,
  };
}

export class SkillsService {
  constructor(private readonly repository: SkillsRepository) {}
  async list(workspaceId: string) {
    return Promise.all((await this.repository.list(workspaceId)).map(async (row) =>
      dto(row, await this.repository.linkedAgentCount(workspaceId, row.id)),
    ));
  }
  async get(workspaceId: string, id: string) {
    const row = await this.repository.get(workspaceId, id);
    return row ? dto(row, await this.repository.linkedAgentCount(workspaceId, id)) : undefined;
  }
  async create(workspaceId: string, input: { name: string; description: string; type: SkillType; body: string; source?: Skill['source']; evidence_files?: string[] }) {
    return dto(await this.repository.create({ workspaceId, ...input, source: input.source ?? 'manual', evidenceFiles: input.evidence_files, enabled: true, version: 1 }));
  }
  async update(workspaceId: string, id: string, input: { name: string; description: string; type: SkillType; body: string; enabled: boolean; expected_version: number }) {
    const { expected_version, ...patch } = input;
    const result = await this.repository.update(workspaceId, id, expected_version, patch);
    if (result.kind === 'missing') throw new NotFoundError('Skill not found');
    if (result.kind === 'conflict') throw new AppError('version_conflict', 'Skill was changed by another editor', 409);
    return dto(result.row, await this.repository.linkedAgentCount(workspaceId, id));
  }
  async delete(workspaceId: string, id: string) {
    if (!(await this.repository.get(workspaceId, id))) throw new NotFoundError('Skill not found');
    if (await this.repository.linkedAgentCount(workspaceId, id)) {
      throw new AppError('skill_in_use', 'Detach this skill from its agents before deleting it', 409);
    }
    return this.repository.delete(workspaceId, id);
  }
  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    const rows = await this.repository.listVersions(workspaceId, id);
    return rows?.map((row) => ({ skill_id: row.skillId, version: row.version, body: row.body, created_at: row.createdAt.toISOString() }));
  }
  async restore(workspaceId: string, id: string, version: number, expectedVersion: number) {
    const skill = await this.get(workspaceId, id);
    const historic = await this.repository.getVersion(workspaceId, id, version);
    if (!skill || !historic) throw new NotFoundError('Skill version not found');
    return this.update(workspaceId, id, { ...skill, body: historic.body, expected_version: expectedVersion });
  }
}
