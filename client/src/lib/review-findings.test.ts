import { describe, expect, it } from 'vitest';
import { latestFindingsPerAgent } from './review-findings';

const finding = (id: string) => ({ id, severity: 'WARNING', category: 'bug', title: id, file: 'a.ts', start_line: 1, end_line: 1, rationale: id, suggestion: null, confidence: 1, kind: 'finding', trifecta_components: null, evidence: null, review_id: id, accepted_at: null, dismissed_at: null }) as never;

describe('latestFindingsPerAgent', () => {
  it('uses deterministic latest reviews per agent', () => {
    const reviews = [
      { id: 'a', agent_id: 'agent', kind: 'review', created_at: '2026-10-10T10:00:00.000Z', findings: [finding('old')] },
      { id: 'z', agent_id: 'agent', kind: 'review', created_at: '2026-10-10T10:00:00.000Z', findings: [finding('new')] },
    ] as never;
    expect(latestFindingsPerAgent(reviews).map((item) => item.id)).toEqual(['new']);
  });
});
