import { assembleOnboardingPrompt, estimateOnboardingPromptTokens } from '@devdigest/reviewer-core';
import { expect, it } from 'vitest';
import { selectOnboardingFacts } from '../src/modules/onboarding/domain/facts.js';

it('does not claim graph rank when all edges refer to absent files', () => {
  const snapshot = selectOnboardingFacts({ estimate: (items) => estimateOnboardingPromptTokens(assembleOnboardingPrompt(items)), files: [{ path: 'b', rank: 5 }, { path: 'a', rank: 1 }], edges: [{ fromFile: 'outside', toFile: 'elsewhere' }], indexedCount: 2, facts: [] });
  expect(snapshot.ranked).toBe(false);
  expect(snapshot.files.map((f) => f.path)).toEqual(['a', 'b']);
  expect(snapshot.files.every((f) => f.rank === null)).toBe(true);
});
