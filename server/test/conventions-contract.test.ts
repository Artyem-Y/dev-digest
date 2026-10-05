import { describe, expect, it } from 'vitest';
import { ConventionCandidate } from '@devdigest/shared';

describe('ConventionCandidate contract', () => {
  it('represents a verified candidate independently from its curation status', () => {
    const parsed = ConventionCandidate.safeParse({
      id: '3b1a4db3-a8b1-4ad1-9d28-e0dbf97b9d0d',
      category: 'async-style',
      rule: 'Use async/await instead of then chains.',
      evidence_path: 'src/api/users.ts',
      evidence_line: 23,
      evidence_snippet: 'const user = await db.users.find(id);',
      confidence: 0.91,
      status: 'accepted',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.status).toBe('accepted');
    expect(parsed.data.evidence_line).toBe(23);
  });
});
