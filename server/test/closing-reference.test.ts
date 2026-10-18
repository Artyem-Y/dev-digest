import { describe, expect, it } from 'vitest';
import { closingIssueNumber } from '../src/modules/intents/application/closing-reference.js';

describe('closingIssueNumber', () => {
  it('accepts explicit closing keywords', () => {
    expect(closingIssueNumber('Fixes #42')).toBe(42);
    expect(closingIssueNumber('resolved: #9')).toBe(9);
  });

  it('does not treat an ordinary issue mention as linked evidence', () => {
    expect(closingIssueNumber('See #42 for background.')).toBeUndefined();
    expect(closingIssueNumber('The rollout has #42 steps.')).toBeUndefined();
  });
});
