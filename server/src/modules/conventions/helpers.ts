import type { ConventionCandidate } from '@devdigest/shared';
import type * as t from '../../db/schema.js';

type ConventionRow = typeof t.conventions.$inferSelect;

/** Convert persistence-owned convention rows to the public shared contract. */
export function toConventionCandidate(row: ConventionRow): ConventionCandidate {
  return {
    id: row.id,
    category: row.category,
    rule: row.editedRule ?? row.rule,
    evidence_path: row.evidencePath!,
    evidence_line: row.evidenceLine!,
    evidence_snippet: row.evidenceSnippet!,
    confidence: row.confidence!,
    status: row.status,
  };
}
