import { expect, it } from 'vitest';
import { datasetFingerprint, hasContradictoryLabels } from '../src/modules/evals/application/dataset.js';
import type { EvalCaseSnapshot } from '../src/modules/evals/application/run-suite.js';

const original: EvalCaseSnapshot = { id: '1', expectation: 'must_find', anchor: { file: 'a', startLine: 1, endLine: 2 }, fixtureId: 'fixture', fixtureHash: 'hash' };

it('fingerprints replay content and semantics, not database identity', () => {
  expect(datasetFingerprint([original])).toBe(datasetFingerprint([{ ...original, id: 'other' }]));
  expect(datasetFingerprint([original])).not.toBe(datasetFingerprint([{ ...original, fixtureHash: 'other' }]));
  expect(datasetFingerprint([original])).not.toBe(datasetFingerprint([{ ...original, expectation: 'must_not_flag' }]));
});

it('detects contradictory overlapping labels only for the same input', () => {
  const negative = { ...original, id: '2', expectation: 'must_not_flag' as const, anchor: { ...original.anchor, startLine: 2, endLine: 3 } };
  expect(hasContradictoryLabels([original, negative])).toBe(true);
  expect(hasContradictoryLabels([original, { ...negative, fixtureHash: 'other' }])).toBe(false);
  expect(hasContradictoryLabels([original, { ...negative, anchor: { ...negative.anchor, startLine: 3 } }])).toBe(false);
  expect(hasContradictoryLabels([{ ...original, fixtureId: 'original-review' }, { ...negative, fixtureId: 'manual' }])).toBe(true);
});
