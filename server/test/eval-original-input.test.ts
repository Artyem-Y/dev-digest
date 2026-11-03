import { describe, expect, it } from 'vitest';
import { originalFragment } from '../src/modules/evals/infrastructure/original-input.js';
import { createHash } from 'node:crypto';

const raw = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\ndiff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -1 +1 @@\n-x\n+y\n';
const hash = createHash('sha256').update(raw).digest('hex');
describe('original review provenance', () => {
  it('returns only the anchored file when the original input hash matches', () => {
    const result = originalFragment(raw, hash, {file: 'a.ts', startLine: 1, endLine: 1});
    expect(result).toContain('+new'); expect(result).not.toContain('b.ts');
  });
  it('rejects changed input and anchors outside the original diff', () => {
    expect(originalFragment(raw + 'changed', hash, {file: 'a.ts', startLine: 1, endLine: 1})).toBeNull();
    expect(originalFragment(raw, hash, {file: 'a.ts', startLine: 2, endLine: 2})).toBeNull();
  });
});
