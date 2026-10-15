import { describe, expect, it } from 'vitest';
import { selectLatestReviewsPerAgent } from '@devdigest/shared';

describe('selectLatestReviewsPerAgent', () => {
  it('keeps the latest completed review for every agent, including a null agent', () => {
    const rows = [
      { id: 'old-a', agent_id: 'a', kind: 'review', created_at: '2026-10-10T09:00:00.000Z' },
      { id: 'new-a', agent_id: 'a', kind: 'review', created_at: '2026-10-10T10:00:00.000Z' },
      { id: 'summary', agent_id: 'b', kind: 'summary', created_at: '2026-10-10T12:00:00.000Z' },
      { id: 'b', agent_id: 'b', kind: 'review', created_at: '2026-10-10T08:00:00.000Z' },
      { id: 'legacy', agent_id: null, kind: 'review', created_at: '2026-10-10T11:00:00.000Z' },
    ];

    expect(selectLatestReviewsPerAgent(rows).map((row) => row.id)).toEqual(['legacy', 'new-a', 'b']);
    expect(rows[0]!.id).toBe('old-a');
  });

  it('uses ID as a deterministic tie breaker', () => {
    const rows = [
      { id: 'a', agent_id: 'agent', kind: 'review', created_at: '2026-10-10T10:00:00.000Z' },
      { id: 'z', agent_id: 'agent', kind: 'review', created_at: '2026-10-10T10:00:00.000Z' },
    ];
    expect(selectLatestReviewsPerAgent(rows).map((row) => row.id)).toEqual(['z']);
  });
});
