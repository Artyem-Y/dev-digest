import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregate } from './run-evals.mjs';

test('aggregate excludes infrastructure failures from quality metrics', () => {
  const benchmark = aggregate({
    baseline: [
      { valid: true, grade: { pass: true }, tokens: 10, elapsed_ms: 100 },
      { valid: false, grade: null, tokens: 500, elapsed_ms: 5000 },
    ],
    candidate: [
      { valid: true, grade: { pass: false }, tokens: 20, elapsed_ms: 200 },
      { valid: false, grade: null, tokens: 600, elapsed_ms: 6000 },
    ],
  });

  assert.deepEqual(benchmark.baseline, {
    attempted_runs: 2,
    valid_runs: 1,
    infra_failures: 1,
    pass_rate: 1,
    tokens: { mean: 10, min: 10, max: 10, stddev: 0 },
    duration_ms: { mean: 100, min: 100, max: 100, stddev: 0 },
  });
  assert.equal(benchmark.candidate.pass_rate, 0);
  assert.equal(benchmark.delta.pass_rate, -1);
  assert.equal(benchmark.candidate.tokens.mean, 20);
});

test('aggregate does not invent a zero-percent score when no run is valid', () => {
  const benchmark = aggregate({
    baseline: [{ valid: false, grade: null }],
    candidate: [{ valid: false, grade: null }],
  });

  assert.equal(benchmark.baseline.pass_rate, null);
  assert.equal(benchmark.candidate.pass_rate, null);
  assert.equal(benchmark.delta.pass_rate, null);
});
