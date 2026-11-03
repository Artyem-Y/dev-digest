import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSummary } from './eval-summary.mjs';

test('reports valid rates, delta and infrastructure failures separately', () => {
  const summary = formatSummary('example', {
    baseline: { attempted_runs: 2, valid_runs: 2, pass_rate: 0.5 },
    candidate: { attempted_runs: 2, valid_runs: 1, pass_rate: 1 },
  });
  assert.match(summary, /example/);
  assert.match(summary, /50\.0%/);
  assert.match(summary, /100\.0%/);
  assert.match(summary, /\+50\.0 pp/);
  assert.match(summary, /1\/2/);
  assert.match(summary, /infrastructure failures: 1/i);
});

test('does not invent a score when a run is invalid', () => {
  const summary = formatSummary('example', {
    baseline: { attempted_runs: 1, valid_runs: 0, pass_rate: null },
    candidate: { attempted_runs: 1, valid_runs: 1, pass_rate: 0 },
  });
  assert.match(summary, /n\/a/i);
  assert.doesNotMatch(summary, /\+0\.0 pp/);
});
