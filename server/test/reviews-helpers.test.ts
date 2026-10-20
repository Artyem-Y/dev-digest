import { describe, it, expect } from 'vitest';
import { taskLine } from '../src/modules/reviews/helpers.js';
import { toMcpRunResult } from '../src/modules/reviews/application/mcp-run-findings.js';

/**
 * Unit coverage for the review task-line. The key invariant: our trusted
 * instruction always tells the model to review the whole diff and never
 * withhold a security/correctness finding — no matter what the PR text claims.
 */

describe('taskLine', () => {
  const pull = { number: 3, title: 'test: vulnerable fixture', author: 'burnjohn' } as never;

  it('names the PR being reviewed', () => {
    const line = taskLine(pull);
    expect(line).toContain('#3');
    expect(line).toContain('test: vulnerable fixture');
  });

  it('keeps the non-negotiable "never withhold security" rule', () => {
    const line = taskLine(pull);
    expect(line).toMatch(/never .*withhold .*(or downgrade )?.*security/i);
    expect(line).toMatch(/review the entire diff/i);
  });
});

describe('toMcpRunResult', () => {
  it('returns bounded findings for one persisted run without its trace', () => {
    const finding = (index: number) => ({
      id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      severity: 'CRITICAL',
      category: 'security',
      title: `Finding ${index}`,
      file: 'src/auth.ts',
      startLine: 12,
      endLine: 12,
      rationale: 'Persisted rationale.',
      suggestion: null,
      confidence: 0.99,
      kind: 'finding',
    });
    const result = toMcpRunResult({
      run: {
        id: '00000000-0000-0000-0000-000000000099',
        status: 'done',
        error: null,
      },
      review: {
        verdict: 'request_changes',
        summary: 'Persisted summary.',
        score: 65,
      },
      findings: Array.from({ length: 20 }, (_, index) => ({ ...finding(index + 1), severity: 'SUGGESTION' }))
        .concat({ ...finding(21), severity: 'CRITICAL' }),
      severityCounts: { critical: 1, warning: 0, suggestion: 20 },
      findingsTruncated: true,
    });

    expect(result).toMatchObject({
      runId: '00000000-0000-0000-0000-000000000099',
      status: 'done',
      verdict: 'request_changes',
      summary: 'Persisted summary.',
      score: 65,
    });
    expect(result.findings).toHaveLength(20);
    expect(result.severityCounts).toEqual({ critical: 1, warning: 0, suggestion: 20 });
    expect(result.findingsTruncated).toBe(true);
    expect(result).not.toHaveProperty('trace');
  });
});
