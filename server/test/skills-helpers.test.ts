import { describe, expect, it } from 'vitest';
import { toSkillDto, toSkillVersionDto } from '../src/modules/skills/helpers.js';

describe('skills DTO helpers', () => {
  it('maps persisted skill data without dropping source evidence or agent count', () => {
    const skill = toSkillDto({ id: 'skill-1', name: 'Boundary checks', description: 'Validate edges', type: 'rubric', source: 'extracted', body: '# Boundary checks', enabled: true, version: 3, evidenceFiles: ['src/api.ts'], createdAt: new Date(), updatedAt: new Date(), workspaceId: 'workspace-1' } as never, 2);

    expect(skill).toMatchObject({ id: 'skill-1', source: 'extracted', version: 3, agent_count: 2, evidence_files: ['src/api.ts'] });
  });

  it('serializes a version timestamp at the API boundary', () => {
    expect(toSkillVersionDto({ skillId: 'skill-1', version: 2, body: 'old', createdAt: new Date('2026-10-05T00:00:00.000Z') } as never)).toEqual({ skill_id: 'skill-1', version: 2, body: 'old', created_at: '2026-10-05T00:00:00.000Z' });
  });
});
