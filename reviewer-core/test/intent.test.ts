import { describe, expect, it, vi } from 'vitest';
import { derivePullIntent } from '../src/intent.js';

describe('derivePullIntent', () => {
  it('caps the aggregate source payload while preserving source positions', async () => {
    const completeStructured = vi.fn().mockResolvedValue({
      data: { intent: 'Intent', in_scope: [], out_of_scope: [], source_refs: [0, 1, 2], insufficient_evidence: false },
    });

    await derivePullIntent({
      provider: { id: 'openai', completeStructured } as never,
      model: 'gpt-6-luna',
      sources: [
        { kind: 'title', text: 'A'.repeat(12_000) },
        { kind: 'description', text: 'B'.repeat(12_000) },
        { kind: 'issue', text: 'C'.repeat(12_000) },
      ],
    });

    const user = completeStructured.mock.calls[0]![0].messages[1].content as string;
    expect(user).toContain('A'.repeat(12_000));
    expect(user).toContain('B'.repeat(11_999));
    expect(user).toContain('C');
    expect(user).not.toContain('C'.repeat(2));
  });
});
