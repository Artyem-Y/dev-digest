import { createHash } from 'node:crypto';
import { anchorsOverlap, normalizePath } from '../domain/score.js';
import type { EvalCaseSnapshot } from './run-suite.js';

export const EVAL_SCORER_VERSION = '1';

/** Hash only the replay dataset and scoring semantics, never agent settings. */
export function datasetFingerprint(cases: readonly EvalCaseSnapshot[]): string {
  const canonical = cases.map((c) => ({
    expectation: c.expectation,
    anchor: { file: normalizePath(c.anchor.file), startLine: c.anchor.startLine, endLine: c.anchor.endLine },
    fixtureId: c.fixtureId, fixtureHash: c.fixtureHash,
  }));
  return createHash('sha256').update(JSON.stringify({ scorerVersion: EVAL_SCORER_VERSION, cases: canonical })).digest('hex');
}

/** Contradictory labels over the same frozen input cannot form a valid suite. */
export function hasContradictoryLabels(cases: readonly EvalCaseSnapshot[]): boolean {
  for (let i = 0; i < cases.length; i++) {
    for (let j = i + 1; j < cases.length; j++) {
      const a = cases[i]!;
      const b = cases[j]!;
      const sameInput = a.fixtureHash === b.fixtureHash && (a.fixtureId === b.fixtureId || (['original-review', 'manual'].includes(a.fixtureId) && ['original-review', 'manual'].includes(b.fixtureId)));
      if (a.expectation !== b.expectation && sameInput
        && anchorsOverlap(a.anchor, b.anchor)) return true;
    }
  }
  return false;
}
