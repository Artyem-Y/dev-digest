import { describe, expect, it } from 'vitest';
import { anchorsOverlap, scoreCases } from '../src/modules/evals/domain/score.js';

const anchor = { file: 'src/a.ts', startLine: 10, endLine: 12 };

describe('eval scoring', () => {
  it('matches normalized exact paths and inclusive line ranges', () => {
    expect(anchorsOverlap(anchor, { file: './src/a.ts', startLine: 12, endLine: 14 })).toBe(true);
    expect(anchorsOverlap(anchor, { file: 'src/a.ts', startLine: 13, endLine: 14 })).toBe(false);
    expect(anchorsOverlap(anchor, { file: 'src/other.ts', startLine: 10, endLine: 12 })).toBe(false);
  });

  it('scores positive and negative labels without treating unlabeled findings as errors', () => {
    const other = { file: 'src/a.ts', startLine: 20, endLine: 20 };
    const score = scoreCases([
      { expectation: 'must_find', anchor, grounded: [anchor, anchor, other, other], dropped: 1 },
      { expectation: 'must_find', anchor, grounded: [], dropped: 0 },
      { expectation: 'must_not_flag', anchor, grounded: [anchor], dropped: 0 },
    ]);
    expect(score.recall).toBe(0.5);
    expect(score.precision).toBe(0.5);
    expect(score.citationAccuracy).toBe(5 / 6);
    expect(score.counts.unlabeled).toBe(1);
    expect(score.cases.map((c) => c.passed)).toEqual([true, false, false]);
  });

  it('returns unavailable ratios for zero denominators', () => {
    const score = scoreCases([{ expectation: 'must_not_flag', anchor, grounded: [], dropped: 0 }]);
    expect(score).toMatchObject({ recall: null, precision: null, citationAccuracy: null });
    expect(score.cases[0]?.passed).toBe(true);
  });
});
