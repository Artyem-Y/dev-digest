import { describe, expect, it } from 'vitest';
import { partitionFindings } from './findings';

describe('partitionFindings', () => {
  it('anchors findings only at matching right-side lines and retains the rest', () => {
    const result = partitionFindings(
      [
        { id: 'right', file: 'a.ts', start_line: 4 },
        { id: 'left-only', file: 'a.ts', start_line: 3 },
        { id: 'other', file: 'b.ts', start_line: 4 },
      ] as never,
      'a.ts',
      new Set(['RIGHT:4', 'LEFT:3']),
    );
    expect(result.matched.get('RIGHT:4')?.map((finding) => finding.id)).toEqual(['right']);
    expect(result.unmatched.map((finding) => finding.id)).toEqual(['left-only']);
  });
});
