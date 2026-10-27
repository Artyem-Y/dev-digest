import { describe, expect, it } from 'vitest';
import { selectBriefBudget } from '../src/modules/brief/domain/budget.js';

describe('selectBriefBudget', () => {
  it('keeps facts under 4k then spends unused reservation on path-sorted specs capped at 2k', () => {
    const selected = selectBriefBudget(
      [{ path: 'facts', content: 'f'.repeat(4000), estimatedTokens: 1000 }],
      [
        { path: 'z.md', content: 'z'.repeat(12000), estimatedTokens: 3000 },
        { path: 'a.md', content: 'a'.repeat(8000), estimatedTokens: 2000 },
      ],
    );
    expect(selected.facts).toHaveLength(1);
    expect(selected.specs.map((item) => [item.path, item.estimatedTokens])).toEqual([['a.md', 2000], ['z.md', 2000]]);
    expect(selected.total).toBe(5000);
  });

  it('never exceeds the 8k total and reports specs that cannot fit as omitted', () => {
    const selected = selectBriefBudget(
      [{ path: 'facts', content: 'f'.repeat(16000), estimatedTokens: 4000 }],
      Array.from({ length: 3 }, (_, index) => ({ path: `${index}.md`, content: 'x'.repeat(8000), estimatedTokens: 2000 })),
    );
    expect(selected.total).toBe(8000);
    expect(selected.specs).toHaveLength(2);
    expect(selected.omitted.map((item) => item.path)).toEqual(['2.md']);
  });

  it('uses actual content length, truncates oversized documents, and bounds document fan-out', () => {
    const selected = selectBriefBudget(
      [{ path: 'facts', content: 'f'.repeat(50000), estimatedTokens: 1 }],
      Array.from({ length: 30 }, (_, index) => ({ path: `${index}.md`, content: 'x'.repeat(8000), estimatedTokens: 1 })),
    );
    expect(selected.facts[0]!.content.length).toBeLessThanOrEqual(16000);
    expect(selected.specs.every((spec) => spec.content.length <= 8000)).toBe(true);
    expect(selected.specs.length).toBeLessThanOrEqual(20);
    expect(selected.total).toBeLessThanOrEqual(8000);
  });
});
