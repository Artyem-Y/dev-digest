import { describe, expect, it } from 'vitest';
import { buildSmartDiff } from '../src/modules/reviews/smart-diff/domain/build-smart-diff.js';

describe('buildSmartDiff', () => {
  it('keeps role order, input order, distinct finding lines, and total lines', () => {
    const result = buildSmartDiff(
      [
        { path: 'src/a.ts', additions: 4, deletions: 1 },
        { path: 'README.md', additions: 2, deletions: 0 },
        { path: 'pnpm-lock.yaml', additions: 3, deletions: 7 },
      ],
      [
        { file: 'src/a.ts', start_line: 4 },
        { file: 'src/a.ts', start_line: 4 },
        { file: 'README.md', start_line: 1 },
      ],
    );

    expect(result.groups.map((group) => group.role)).toEqual(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
    expect(result.groups[0]!.files[0]!.finding_lines).toEqual([4]);
    expect(result.groups[3]!.files[0]!.finding_lines).toEqual([1]);
    expect(result.split_suggestion).toEqual({ too_big: false, total_lines: 17, proposed_splits: [] });
  });

  it('marks an oversized PR and proposes deterministic category splits', () => {
    const result = buildSmartDiff(
      [
        { path: 'src/core.ts', additions: 4_900, deletions: 100 },
      ],
      [],
    );

    expect(result.split_suggestion).toEqual({
      too_big: true,
      total_lines: 5_000,
      proposed_splits: [
        { name: 'Core logic', files: ['src/core.ts'] },
      ],
    });
  });
});
