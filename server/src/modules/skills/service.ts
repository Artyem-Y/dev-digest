import type { Skill, SkillType } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import { AppError, NotFoundError } from '../../platform/errors.js';

function dto(row: Awaited<ReturnType<SkillsRepository['get']>> & {}) : Skill {
  return {
    id: row!.id,
    name: row!.name,
    description: row!.description,
    type: row!.type as SkillType,
    source: row!.source as Skill['source'],
    body: row!.body,
    enabled: row!.enabled,
    version: row!.version,
    evidence_files: row!.evidenceFiles ?? null,
  };
}

export class SkillsService {
  constructor(private readonly repository: SkillsRepository) {}
  async list(workspaceId: string) { return (await this.repository.list(workspaceId)).map((row) => dto(row)); }
  async get(workspaceId: string, id: string) { const row = await this.repository.get(workspaceId, id); return row ? dto(row) : undefined; }
  async create(workspaceId: string, input: { name: string; description: string; type: SkillType; body: string }) {
    return dto(await this.repository.create({ workspaceId, ...input, source: 'manual', enabled: true, version: 1 }));
  }
  async update(workspaceId: string, id: string, input: { name: string; description: string; type: SkillType; body: string; enabled: boolean; expected_version: number }) {
    const { expected_version, ...patch } = input;
    const result = await this.repository.update(workspaceId, id, expected_version, patch);
    if (result.kind === 'missing') throw new NotFoundError('Skill not found');
    if (result.kind === 'conflict') throw new AppError('version_conflict', 'Skill was changed by another editor', 409);
    return dto(result.row);
  }
  async delete(workspaceId: string, id: string) {
    if (!(await this.repository.get(workspaceId, id))) throw new NotFoundError('Skill not found');
    if (await this.repository.linkedAgentCount(workspaceId, id)) {
      throw new AppError('skill_in_use', 'Detach this skill from its agents before deleting it', 409);
    }
    return this.repository.delete(workspaceId, id);
  }
}
