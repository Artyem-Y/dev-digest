import type { Skill, SkillType, SkillVersion } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';

export class SkillsService {
  constructor(private readonly repository: SkillsRepository) {}
  async list(workspaceId: string) {
    return Promise.all((await this.repository.list(workspaceId)).map(async (row) =>
      toSkillDto(row, await this.repository.linkedAgentCount(workspaceId, row.id)),
    ));
  }
  async get(workspaceId: string, id: string) {
    const row = await this.repository.get(workspaceId, id);
    return row ? toSkillDto(row, await this.repository.linkedAgentCount(workspaceId, id)) : undefined;
  }
  async create(workspaceId: string, input: { name: string; description: string; type: SkillType; body: string; source?: Skill['source']; evidence_files?: string[] }) {
    return toSkillDto(await this.repository.create({ workspaceId, ...input, source: input.source ?? 'manual', evidenceFiles: input.evidence_files, enabled: true, version: 1 }));
  }
  async update(workspaceId: string, id: string, input: { name: string; description: string; type: SkillType; body: string; enabled: boolean; expected_version: number }) {
    const { expected_version, ...patch } = input;
    const result = await this.repository.update(workspaceId, id, expected_version, patch);
    if (result.kind === 'missing') throw new NotFoundError('Skill not found');
    if (result.kind === 'conflict') throw new AppError('version_conflict', 'Skill was changed by another editor', 409);
    return toSkillDto(result.row, await this.repository.linkedAgentCount(workspaceId, id));
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
    return rows?.map(toSkillVersionDto);
  }
  async restore(workspaceId: string, id: string, version: number, expectedVersion: number) {
    const skill = await this.get(workspaceId, id);
    const historic = await this.repository.getVersion(workspaceId, id, version);
    if (!skill || !historic) throw new NotFoundError('Skill version not found');
    return this.update(workspaceId, id, { ...skill, body: historic.body, expected_version: expectedVersion });
  }
  async deleteVersion(workspaceId: string, id: string, version: number) {
    const skill = await this.get(workspaceId, id);
    if (!skill) throw new NotFoundError('Skill not found');
    if (skill.version === version) throw new AppError('current_version', 'The current skill version cannot be deleted', 409);
    if (!(await this.repository.deleteVersion(workspaceId, id, version))) throw new NotFoundError('Skill version not found');
    return true;
  }
}
