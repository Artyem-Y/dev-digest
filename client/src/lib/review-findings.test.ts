import { describe, expect, it } from 'vitest';
import { findingsForFiles } from './review-findings';

describe('findingsForFiles', () => {
  it('keeps findings in their group when a reviewer returns a unified-diff path', () => {
    const findings = [
      { id: 'test', file: 'a/client/src/math.test.tsx' },
      { id: 'wiring', file: './server/src/index.ts' },
      { id: 'other', file: 'docs/guide.md' },
    ] as never;

    expect(findingsForFiles([{ path: 'client/src/math.test.tsx' }], findings)).toMatchObject([
      { id: 'test', file: 'client/src/math.test.tsx' },
    ]);
    expect(findingsForFiles([{ path: 'server/src/index.ts' }], findings)).toMatchObject([
      { id: 'wiring', file: 'server/src/index.ts' },
    ]);
  });
});
