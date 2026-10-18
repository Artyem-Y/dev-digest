import { describe, expect, it } from 'vitest';
import { smartDiffPathMismatches } from '../lib/smart-diff';

const files = [{ path: 'src/current.ts' }];

describe('smartDiffPathMismatches', () => {
  it('detects a stale group path and a current file absent from every group', () => {
    const smartDiff = {
      groups: [{ role: 'core', files: [{ path: 'src/stale.ts' }] }],
    };

    expect(smartDiffPathMismatches(files, smartDiff as never)).toEqual(['src/stale.ts', 'src/current.ts']);
  });

  it('accepts a grouping that covers every current file exactly', () => {
    const smartDiff = {
      groups: [{ role: 'core', files: [{ path: 'src/current.ts' }] }],
    };

    expect(smartDiffPathMismatches(files, smartDiff as never)).toEqual([]);
  });
});
