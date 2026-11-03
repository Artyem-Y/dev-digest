import { expect, it } from 'vitest';
import { containsLikelySecret } from '../src/modules/evals/domain/sensitive-input.js';
it('detects common secret shapes without returning the matched content', () => {
  expect(containsLikelySecret('password = "abcdefghijklmnop"')).toBe(true);
  expect(containsLikelySecret('-----BEGIN PRIVATE KEY-----')).toBe(true);
  expect(containsLikelySecret('const value = 123')).toBe(false);
});
