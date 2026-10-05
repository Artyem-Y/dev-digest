import type { Skill, SkillType, SkillVersion } from '@devdigest/shared';
import type * as t from '../../db/schema.js';

type SkillRow = typeof t.skills.$inferSelect;
type SkillVersionRow = typeof t.skillVersions.$inferSelect;

/** Convert persistence-owned Skills rows at the module API boundary. */
export function toSkillDto(row: SkillRow, agentCount = 0): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as Skill['source'],
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    agent_count: agentCount,
    evidence_files: row.evidenceFiles ?? null,
  };
}

/** Convert version rows and keep serialization decisions out of services. */
export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return { skill_id: row.skillId, version: row.version, body: row.body, created_at: row.createdAt.toISOString() };
}
